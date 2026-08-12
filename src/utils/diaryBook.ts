import { jsPDF } from 'jspdf';
import type { DiaryEntry } from '../types/diary';
import { formatDate } from './date';
import { fontFamilyForEntry } from './fonts';
import { captureDiaryEntryPaperBlob } from './captureDiaryPaper';
import { saveOrShareBlob } from './saveBlob';

export { downloadViaAnchor as downloadBlob } from './saveBlob';

/** 표지 페이지 비율 (세로) */
export const BOOK_W = 900;
export const BOOK_H = 1200;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('그림을 불러오지 못했어요'));
    img.src = src;
  });
}

function getDiaryFont(fontId?: string): string {
  return fontFamilyForEntry(fontId);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function themeColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = BOOK_W;
  canvas.height = BOOK_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('일기장 페이지를 만들 수 없어요');
  return { canvas, ctx };
}

/** 표지 — 현재 테마 색 사용 */
export async function renderCoverPage(entries: DiaryEntry[]): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = createPageCanvas();
  const font = getDiaryFont();

  const bg = themeColor('--color-bg', '#ffffff');
  const surface = themeColor('--color-surface', '#ffffff');
  const text = themeColor('--color-text', '#1a1a1a');
  const muted = themeColor('--color-text-muted', '#6b6b6b');
  const border = themeColor('--color-border-soft', '#ebebeb');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BOOK_W, BOOK_H);

  ctx.fillStyle = surface;
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, 70, 120, BOOK_W - 140, BOOK_H - 240, 20);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  roundRect(ctx, 70, 120, BOOK_W - 140, BOOK_H - 240, 20);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = `700 36px ${font}`;
  ctx.textAlign = 'center';
  ctx.fillText('my diary', BOOK_W / 2, 280);

  ctx.fillStyle = text;
  ctx.font = `700 72px ${font}`;
  ctx.fillText('PageBy', BOOK_W / 2, 420);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]?.date;
  const last = sorted[sorted.length - 1]?.date;
  ctx.fillStyle = muted;
  ctx.font = `500 32px ${font}`;
  if (first && last) {
    const range =
      first === last
        ? formatDate(first)
        : `${formatDate(first)} ~ ${formatDate(last)}`;
    ctx.fillText(range, BOOK_W / 2, 520);
  }
  ctx.fillText(`총 ${entries.length}편`, BOOK_W / 2, 580);

  ctx.fillStyle = muted;
  ctx.font = `600 28px ${font}`;
  ctx.fillText('옆으로 넘겨 읽어 보세요', BOOK_W / 2, BOOK_H - 220);
  ctx.textAlign = 'left';

  return canvas;
}

/**
 * 일기 한 편 — 상세 PNG 다운로드와 동일한 paper 캡처.
 * (여백·책 프레임 없이 paper 이미지 그대로)
 */
export async function renderEntryPage(entry: DiaryEntry): Promise<HTMLCanvasElement> {
  const blob = await captureDiaryEntryPaperBlob(entry);
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('일기장 페이지를 만들 수 없어요');
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type BookPage = {
  label: string;
  canvas: HTMLCanvasElement;
  dataUrl: string;
};

/** 표지 + 일기 페이지들 (날짜 오름차순) */
export async function buildBookPages(entries: DiaryEntry[]): Promise<BookPage[]> {
  if (entries.length === 0) throw new Error('다운로드할 일기가 없어요');

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const pages: BookPage[] = [];

  const cover = await renderCoverPage(sorted);
  pages.push({
    label: '표지',
    canvas: cover,
    dataUrl: cover.toDataURL('image/png'),
  });

  for (const entry of sorted) {
    const page = await renderEntryPage(entry);
    pages.push({
      label: entry.title || formatDate(entry.date),
      canvas: page,
      dataUrl: page.toDataURL('image/png'),
    });
  }

  return pages;
}

/** 이미 만든 책 페이지로 PDF 생성 (미리보기와 동일한 이미지) */
export async function buildPdfFromBookPages(pages: BookPage[]): Promise<Blob> {
  if (pages.length === 0) throw new Error('다운로드할 일기가 없어요');

  const first = pages[0].canvas;
  const pdf = new jsPDF({
    orientation: first.width >= first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height],
    hotfixes: ['px_scaling'],
  });

  pages.forEach((page, i) => {
    const { width: w, height: h } = page.canvas;
    if (i > 0) {
      pdf.addPage([w, h], w >= h ? 'landscape' : 'portrait');
    }
    pdf.addImage(page.dataUrl, 'PNG', 0, 0, w, h);
  });

  return pdf.output('blob');
}

/** 페이지 이미지들로 PDF 생성 */
export async function buildDiaryBookPdf(entries: DiaryEntry[]): Promise<Blob> {
  const pages = await buildBookPages(entries);
  return buildPdfFromBookPages(pages);
}

export async function downloadDiaryBookPdf(
  entries: DiaryEntry[],
  filename = 'diary.pdf',
) {
  const blob = await buildDiaryBookPdf(entries);
  return saveOrShareBlob(blob, filename, {
    title: filename,
    text: 'PageBy 일기장',
  });
}

export async function downloadBookPagesPdf(
  pages: BookPage[],
  filename = 'diary.pdf',
) {
  const blob = await buildPdfFromBookPages(pages);
  return saveOrShareBlob(blob, filename, {
    title: filename,
    text: 'PageBy 일기장',
  });
}
