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
  // 상세 화면 바깥 배경
  ctx.fillStyle = '#faf8f4';
  ctx.fillRect(0, 0, BOOK_W, BOOK_H);

  // diary-detail__paper 와 동일
  const cardX = 36;
  const cardY = 36;
  const cardW = BOOK_W - 72;
  const cardH = BOOK_H - 72;
  ctx.shadowColor = 'rgba(80, 60, 20, 0.07)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
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

/** 일기 한 편 — diary-detail__paper 와 동일 구성 */
export async function renderEntryPage(entry: DiaryEntry): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = createPageCanvas();
  const font = getDiaryFont();
  paintPaperBackground(ctx);

  // paper: margin 36 + padding 16*≈2.1 → 내부 시작
  const pad = 36 + 34; // ≈ paper margin + padding
  const contentRight = BOOK_W - pad;
  const contentW = contentRight - pad;
  const gap = 30; // detail gap 14px 스케일
  let y = pad + 8;

  // dateline
  const mood = MOOD_MAP[entry.mood];
  ctx.fillStyle = '#2c2a26';
  ctx.font = `700 34px ${font}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(formatDate(entry.date), pad, y);
  ctx.font = `400 36px ${font}`;
  const moodEmoji = mood.emoji;
  ctx.fillText(moodEmoji, contentRight - ctx.measureText(moodEmoji).width, y);
  y += gap + 8;

  // title box (diary-detail__title)
  if (entry.title.trim()) {
    ctx.font = `700 34px ${font}`;
    const titleLines = wrapText(ctx, entry.title.trim(), contentW - 48, 2);
    const titlePadY = 22;
    const titleLineH = 40;
    const titleBoxH = titlePadY * 2 + titleLines.length * titleLineH - 8;
    roundRect(ctx, pad, y, contentW, titleBoxH, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#efe8dc';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2c2a26';
    ctx.font = `700 34px ${font}`;
    let ty = y + titlePadY + 28;
    for (const line of titleLines) {
      ctx.fillText(line, pad + 24, ty);
      ty += titleLineH;
    }
    y += titleBoxH + gap;
  }

  // image — 가로·세로 여백
  if (entry.imageUrl) {
    try {
      const img = await loadImage(entry.imageUrl);
      const imgInsetX = 28;
      const imgInsetY = 20;
      const dw = contentW - imgInsetX * 2;
      const maxH = 360;
      const drawH = (img.height / img.width) * dw;
      const finalH = Math.min(drawH, maxH);
      const dx = pad + imgInsetX;

      y += imgInsetY;

      roundRect(ctx, dx, y, dw, finalH, 12);
      ctx.save();
      ctx.clip();
      if (drawH > maxH) {
        const srcH = (maxH / drawH) * img.height;
        const srcY = (img.height - srcH) / 2;
        ctx.drawImage(img, 0, srcY, img.width, srcH, dx, y, dw, finalH);
      } else {
        ctx.drawImage(img, dx, y, dw, finalH);
      }
      ctx.restore();

      roundRect(ctx, dx, y, dw, finalH, 12);
      ctx.strokeStyle = '#efe8dc';
      ctx.lineWidth = 2;
      ctx.stroke();
      y += finalH + imgInsetY + gap;
    } catch {
      // skip
    }
  }

  // content lined paper — 공간 축소
  const contentLineH = 36;
  const contentFont = 28;
  const contentTop = y + 4;
  const maxContentLines = 7;
  const contentBlockH = contentLineH * maxContentLines;
  const linedBottom = contentTop + contentBlockH;

  ctx.strokeStyle = '#e8dcc8';
  ctx.lineWidth = 1.5;
  for (let ly = contentTop + contentLineH; ly <= linedBottom; ly += contentLineH) {
    ctx.beginPath();
    ctx.moveTo(pad + 8, ly);
    ctx.lineTo(contentRight - 8, ly);
    ctx.stroke();
  }

  if (entry.content.trim()) {
    ctx.fillStyle = '#2c2a26';
    ctx.font = `400 ${contentFont}px ${font}`;
    let ty = contentTop + contentFont;
    for (const line of wrapText(ctx, entry.content.trim(), contentW - 16, maxContentLines)) {
      ctx.fillText(line, pad + 8, ty);
      ty += contentLineH;
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
