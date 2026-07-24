import { jsPDF } from 'jspdf';
import type { DiaryEntry } from '../types/diary';
import { MOOD_MAP } from '../types/diary';
import { formatDate } from './date';

/** 책 페이지 비율 (세로) */
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

function getDiaryFont(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--diary-font')
    .trim();
  return raw || '"Gaegu", "Apple SD Gothic Neo", sans-serif';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/).filter((p) => p.length > 0);
  if (paragraphs.length === 0) return lines;

  for (const paragraph of paragraphs) {
    let line = '';
    for (const ch of paragraph) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines) {
          const last = lines[lines.length - 1];
          lines[lines.length - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
          return lines;
        }
      } else {
        line = test;
      }
    }
    if (line) {
      lines.push(line);
      if (lines.length >= maxLines) break;
    }
  }
  return lines.slice(0, maxLines);
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

function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = BOOK_W;
  canvas.height = BOOK_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('일기장 페이지를 만들 수 없어요');
  return { canvas, ctx };
}

function paintPaperBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, BOOK_H);
  bg.addColorStop(0, '#fffdf8');
  bg.addColorStop(1, '#fff4e6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BOOK_W, BOOK_H);

  // 살짝 줄무늬
  ctx.strokeStyle = 'rgba(224, 213, 192, 0.45)';
  ctx.lineWidth = 1;
  for (let y = 160; y < BOOK_H - 60; y += 42) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(BOOK_W - 64, y);
    ctx.stroke();
  }
}

/** 표지 */
export async function renderCoverPage(entries: DiaryEntry[]): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = createPageCanvas();
  const font = getDiaryFont();

  const bg = ctx.createLinearGradient(0, 0, BOOK_W, BOOK_H);
  bg.addColorStop(0, '#ffe8cc');
  bg.addColorStop(0.5, '#ffd8a8');
  bg.addColorStop(1, '#f8d7a8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BOOK_W, BOOK_H);

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 30;
  roundRect(ctx, 70, 120, BOOK_W - 140, BOOK_H - 240, 28);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#9a6b0a';
  ctx.font = `700 36px ${font}`;
  ctx.textAlign = 'center';
  ctx.fillText('my diary', BOOK_W / 2, 280);

  ctx.fillStyle = '#3d3a34';
  ctx.font = `700 72px ${font}`;
  ctx.fillText('diary', BOOK_W / 2, 420);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]?.date;
  const last = sorted[sorted.length - 1]?.date;
  ctx.fillStyle = '#868e96';
  ctx.font = `500 32px ${font}`;
  if (first && last) {
    const range =
      first === last
        ? formatDate(first)
        : `${formatDate(first)} ~ ${formatDate(last)}`;
    ctx.fillText(range, BOOK_W / 2, 520);
  }
  ctx.fillText(`총 ${entries.length}편`, BOOK_W / 2, 580);

  ctx.fillStyle = '#adb5bd';
  ctx.font = `600 28px ${font}`;
  ctx.fillText('옆으로 넘겨 읽어 보세요', BOOK_W / 2, BOOK_H - 220);
  ctx.textAlign = 'left';

  return canvas;
}

/** 일기 한 편 페이지 */
export async function renderEntryPage(entry: DiaryEntry): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = createPageCanvas();
  const font = getDiaryFont();
  paintPaperBackground(ctx);

  const pad = 72;
  let y = 90;

  const mood = MOOD_MAP[entry.mood];
  ctx.fillStyle = '#868e96';
  ctx.font = `500 28px ${font}`;
  ctx.fillText(formatDate(entry.date), pad, y);
  const moodText = `${mood.emoji} ${mood.label}`;
  const moodW = ctx.measureText(moodText).width;
  ctx.fillText(moodText, BOOK_W - pad - moodW, y);
  y += 50;

  ctx.strokeStyle = '#e0d5c0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(BOOK_W - pad, y);
  ctx.stroke();
  y += 48;

  if (entry.title.trim()) {
    ctx.fillStyle = '#212529';
    ctx.font = `700 44px ${font}`;
    for (const line of wrapText(ctx, entry.title.trim(), BOOK_W - pad * 2, 2)) {
      ctx.fillText(line, pad, y);
      y += 56;
    }
    y += 12;
  }

  if (entry.imageUrl) {
    try {
      const img = await loadImage(entry.imageUrl);
      const maxW = BOOK_W - pad * 2;
      const maxH = 420;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (BOOK_W - dw) / 2;
      roundRect(ctx, dx - 6, y - 6, dw + 12, dh + 12, 18);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#eee3cf';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.drawImage(img, dx, y, dw, dh);
      y += dh + 36;
    } catch {
      // skip
    }
  }

  if (entry.content.trim()) {
    ctx.fillStyle = '#495057';
    ctx.font = `400 32px ${font}`;
    const remain = Math.max(4, Math.floor((BOOK_H - 80 - y) / 42));
    for (const line of wrapText(ctx, entry.content.trim(), BOOK_W - pad * 2, remain)) {
      ctx.fillText(line, pad, y);
      y += 42;
    }
  }

  return canvas;
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
    dataUrl: cover.toDataURL('image/jpeg', 0.92),
  });

  for (const entry of sorted) {
    const page = await renderEntryPage(entry);
    pages.push({
      label: entry.title || formatDate(entry.date),
      canvas: page,
      dataUrl: page.toDataURL('image/jpeg', 0.92),
    });
  }

  return pages;
}

/** 페이지 이미지들로 PDF 생성 */
export async function buildDiaryBookPdf(entries: DiaryEntry[]): Promise<Blob> {
  const pages = await buildBookPages(entries);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [BOOK_W, BOOK_H],
    hotfixes: ['px_scaling'],
  });

  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage([BOOK_W, BOOK_H], 'portrait');
    pdf.addImage(page.dataUrl, 'JPEG', 0, 0, BOOK_W, BOOK_H);
  });

  return pdf.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadDiaryBookPdf(
  entries: DiaryEntry[],
  filename = 'diary.pdf',
) {
  const blob = await buildDiaryBookPdf(entries);
  downloadBlob(blob, filename);
}
