import { jsPDF } from 'jspdf';
import type { DiaryEntry } from '../types/diary';
import { formatDate } from './date';
import { fontFamilyForEntry } from './fonts';
import { captureDiaryEntryPaperBlob } from './captureDiaryPaper';
import { materializeImageSrc } from './materializeImage';
import { downloadToDevice } from './saveBlob';

export { downloadViaAnchor as downloadBlob } from './saveBlob';

/** 표지 페이지 비율 (세로) */
export const BOOK_W = 900;
export const BOOK_H = 1200;

const BOOK_CAPTURE = {
  scale: 1.2,
  type: 'image/jpeg',
  quality: 0.8,
} as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('그림을 불러오지 못했어요'));
    img.src = src;
  });
}

/** http(s) 이미지는 data URL로 바꾼 뒤 로드 — PDF toBlob tainted 방지 */
async function loadImageSafe(src: string): Promise<HTMLImageElement> {
  const safe = await materializeImageSrc(src);
  return loadImage(safe);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error('일기장 페이지를 만들 수 없어요'));
        },
        type,
        quality,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'SecurityError') {
        reject(
          new Error(
            '프로필/그림 때문에 PDF를 만들지 못했어요. 잠시 후 다시 시도해 주세요',
          ),
        );
        return;
      }
      reject(err instanceof Error ? err : new Error('일기장 페이지를 만들 수 없어요'));
    }
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

/** 1페이지 diary-book__cover 와 같은 안쪽 영역 (padding 8% 6%) */
const FRAME_PAD_X = 0.06;
const FRAME_PAD_Y = 0.08;
const FRAME_R = 20;

function frameRect() {
  const x = Math.round(BOOK_W * FRAME_PAD_X);
  const y = Math.round(BOOK_H * FRAME_PAD_Y);
  return {
    x,
    y,
    w: BOOK_W - x * 2,
    h: BOOK_H - y * 2,
  };
}

export type BookSlot = { x: number; y: number; w: number; h: number };

export function paperSlotInBook(iw: number, ih: number): BookSlot {
  const frame = frameRect();
  const scale = Math.min(frame.w / Math.max(iw, 1), frame.h / Math.max(ih, 1));
  const w = iw * scale;
  const h = ih * scale;
  return {
    x: frame.x + (frame.w - w) / 2,
    y: frame.y + (frame.h - h) / 2,
    w,
    h,
  };
}

function drawBookFrame(
  ctx: CanvasRenderingContext2D,
  bg: string,
  surface: string,
  border: string,
  frame: BookSlot = frameRect(),
) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BOOK_W, BOOK_H);

  ctx.fillStyle = surface;
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, frame.x, frame.y, frame.w, frame.h, FRAME_R);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  roundRect(ctx, frame.x, frame.y, frame.w, frame.h, FRAME_R);
  ctx.stroke();
  return frame;
}

function fillImageInFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
): BookSlot {
  const slot = paperSlotInBook(img.naturalWidth || img.width, img.naturalHeight || img.height);
  ctx.save();
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, FRAME_R);
  ctx.clip();
  ctx.drawImage(img, slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
  return slot;
}

function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = BOOK_W;
  canvas.height = BOOK_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('일기장 페이지를 만들 수 없어요');
  return { canvas, ctx };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
    reader.readAsDataURL(blob);
  });
}

async function pageFromBlob(blob: Blob, label: string): Promise<BookPage> {
  const blobUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(blobUrl);
    return {
      label,
      blobUrl,
      blob,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    };
  } catch (err) {
    URL.revokeObjectURL(blobUrl);
    throw err;
  }
}

export type CoverOptions = {
  avatarUrl?: string | null;
  rangeStart?: string;
  rangeEnd?: string;
  slot?: BookSlot;
};

function coverDateLabel(
  entries: DiaryEntry[],
  rangeStart?: string,
  rangeEnd?: string,
): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const from = rangeStart || sorted[0]?.date || '';
  const to = rangeEnd || sorted[sorted.length - 1]?.date || from;
  if (!from) return '';
  return `${from} ~ ${to}`;
}

async function drawCoverAvatar(
  ctx: CanvasRenderingContext2D,
  avatarUrl: string | null | undefined,
  cx: number,
  cy: number,
  radius: number,
  border: string,
  fill: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  if (avatarUrl) {
    try {
      const img = await loadImageSafe(avatarUrl);
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const size = radius * 2;
      const scale = Math.max(size / Math.max(iw, 1), size / Math.max(ih, 1));
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    } catch {
      // 프로필 없으면 빈 원
    }
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** 표지 — PageBy + 원형 프로필 + YYYY-MM-DD ~ YYYY-MM-DD */
export async function renderCoverPage(
  entries: DiaryEntry[],
  options?: CoverOptions,
): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = createPageCanvas();
  const font = getDiaryFont();

  const bg = themeColor('--color-bg', '#ffffff');
  const surface = themeColor('--color-surface', '#ffffff');
  const text = themeColor('--color-text', '#1a1a1a');
  const muted = themeColor('--color-text-muted', '#6b6b6b');
  const border = themeColor('--color-border-soft', '#ebebeb');

  const frame = drawBookFrame(ctx, bg, surface, border, options?.slot);
  const cx = frame.x + frame.w / 2;
  const padX = Math.round(frame.w * 0.08);
  const padY = Math.round(frame.h * 0.08);
  const brandSize = Math.round(Math.min(52, frame.h * 0.08));
  const dateSize = Math.round(Math.min(30, frame.h * 0.045));
  const gap = Math.round(frame.h * 0.035);
  const brandY = frame.y + padY + brandSize;
  const dateY = frame.y + frame.h - padY;
  const avatarR = Math.min(
    (frame.w - padX * 2) / 2,
    Math.max(24, (dateY - dateSize - brandY - gap * 2) / 2),
  );
  const avatarCy = brandY + gap + avatarR;

  ctx.fillStyle = text;
  ctx.font = `700 ${brandSize}px ${font}`;
  ctx.textAlign = 'center';
  ctx.fillText('PageBy', cx, brandY);

  await drawCoverAvatar(
    ctx,
    options?.avatarUrl,
    cx,
    avatarCy,
    avatarR,
    border,
    bg,
  );

  const range = coverDateLabel(entries, options?.rangeStart, options?.rangeEnd);
  if (range) {
    ctx.fillStyle = muted;
    ctx.font = `500 ${dateSize}px ${font}`;
    ctx.fillText(range, cx, avatarCy + avatarR + gap + dateSize);
  }
  ctx.textAlign = 'left';

  return canvas;
}

export type BookPage = {
  label: string;
  blobUrl: string;
  blob: Blob;
  width: number;
  height: number;
  slot?: BookSlot;
};

export function revokeBookPage(page: BookPage) {
  URL.revokeObjectURL(page.blobUrl);
}

export async function renderCoverBookPage(
  entries: DiaryEntry[],
  options?: CoverOptions,
): Promise<BookPage> {
  const canvas = await renderCoverPage(entries, options);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  return pageFromBlob(blob, '표지');
}

export async function renderEntryBookPage(entry: DiaryEntry): Promise<BookPage> {
  const paperBlob = await captureDiaryEntryPaperBlob(entry, null, BOOK_CAPTURE);
  const paperUrl = URL.createObjectURL(paperBlob);
  try {
    const img = await loadImage(paperUrl);
    const { canvas, ctx } = createPageCanvas();
    const bg = themeColor('--color-bg', '#ffffff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, BOOK_W, BOOK_H);
    const slot = fillImageInFrame(ctx, img);

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
    const page = await pageFromBlob(blob, entry.title || formatDate(entry.date));
    return { ...page, slot };
  } finally {
    URL.revokeObjectURL(paperUrl);
  }
}

/** 표지 + 일기 페이지들 (날짜 오름차순) — PDF 등에서 전부 필요할 때 */
export async function buildBookPages(entries: DiaryEntry[]): Promise<BookPage[]> {
  if (entries.length === 0) throw new Error('다운로드할 일기가 없어요');

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const rest: BookPage[] = [];
  for (const entry of sorted) {
    rest.push(await renderEntryBookPage(entry));
  }
  const cover = await renderCoverBookPage(sorted, { slot: rest[0]?.slot });
  return [cover, ...rest];
}

/** 이미 만든 책 페이지로 PDF 생성 (미리보기와 동일한 이미지) */
export async function buildPdfFromBookPages(pages: BookPage[]): Promise<Blob> {
  if (pages.length === 0) throw new Error('다운로드할 일기가 없어요');

  const first = pages[0];
  const pdf = new jsPDF({
    orientation: first.width >= first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height],
    hotfixes: ['px_scaling'],
  });

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const w = page.width;
    const h = page.height;
    if (i > 0) {
      pdf.addPage([w, h], w >= h ? 'landscape' : 'portrait');
    }
    const dataUrl = await blobToDataUrl(page.blob);
    const format = page.blob.type.includes('jpeg') ? 'JPEG' : 'PNG';
    pdf.addImage(dataUrl, format, 0, 0, w, h);
  }

  return pdf.output('blob');
}

/** 페이지 이미지들로 PDF 생성 */
export async function buildDiaryBookPdf(entries: DiaryEntry[]): Promise<Blob> {
  const pages = await buildBookPages(entries);
  try {
    return await buildPdfFromBookPages(pages);
  } finally {
    pages.forEach(revokeBookPage);
  }
}

export async function downloadDiaryBookPdf(
  entries: DiaryEntry[],
  filename = 'diary.pdf',
) {
  const blob = await buildDiaryBookPdf(entries);
  return downloadToDevice(blob, filename);
}

export async function downloadBookPagesPdf(
  pages: BookPage[],
  filename = 'diary.pdf',
) {
  const blob = await buildPdfFromBookPages(pages);
  return downloadToDevice(blob, filename);
}
