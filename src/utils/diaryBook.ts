import { jsPDF } from 'jspdf';
import type { DiaryEntry } from '../types/diary';
import { formatDate } from './date';
import { ensureDiaryFontReady, fontFamilyForEntry } from './fonts';
import { captureDiaryEntryPaperBlob, type CapturePaperOptions } from './captureDiaryPaper';
import { materializeImageSrc } from './materializeImage';
import { downloadToDevice } from './saveBlob';
import { withTimeout } from './withTimeout';

export { downloadViaAnchor as downloadBlob } from './saveBlob';

/** 표지 페이지 비율 (세로) */
export const BOOK_W = 900;
export const BOOK_H = 1200;

const BOOK_CAPTURE = {
  scale: 1.2,
  type: 'image/jpeg',
  quality: 0.8,
} as const;

/** 화면에서 넘기며 볼 때 — 일기 그림 축소 없이 (상세와 동일 비율) */
export const BOOK_PREVIEW_CAPTURE: CapturePaperOptions = {
  scale: 1.2,
  type: 'image/jpeg',
  quality: 0.82,
  paperWidth: 420,
};

export const BOOK_PREVIEW_SIZE = { w: BOOK_W, h: BOOK_H } as const;

/** SNS: 일기 paper 실제 크기 그대로 (큰 프레임에 끼워 늘리지 않음) */
export const SNS_CAPTURE: CapturePaperOptions = {
  scale: 2,
  type: 'image/jpeg',
  quality: 0.92,
};

/**
 * PDF 전용 — SNS와 같은 구도(그림 축소 없음)이되 scale↓ 로 캡처 가속.
 * (scale 2는 픽셀 4배 → 장당 체감이 큼)
 */
export const BOOK_PDF_CAPTURE: CapturePaperOptions = {
  scale: 1.15,
  type: 'image/jpeg',
  quality: 0.84,
  paperWidth: 420,
};

/** offscreen 캡처가 동시에 겹치면 WebView가 수 장에서 멈춤 → 한 번에 하나 */
let captureQueue: Promise<unknown> = Promise.resolve();
let captureEpoch = 0;

/**
 * 진행 중·대기 중 캡처가 끝날 때까지 기다림.
 * (예전 reset은 대기열만 끊고 실행 중 캡처는 남겨 동시 캡처 → 3~5장에서 멈춤)
 */
export async function drainBookCaptureQueue(): Promise<void> {
  captureEpoch += 1;
  try {
    await captureQueue;
  } catch {
    // ignore
  }
}

/** @deprecated drainBookCaptureQueue 사용 */
export function resetBookCaptureQueue() {
  void drainBookCaptureQueue();
}

function enqueueCapture<T>(task: () => Promise<T>): Promise<T> {
  const epoch = captureEpoch;
  const result = captureQueue.then(
    () => {
      if (epoch !== captureEpoch) {
        return Promise.reject(new Error('캡처가 취소됐어요'));
      }
      return task();
    },
    () => {
      if (epoch !== captureEpoch) {
        return Promise.reject(new Error('캡처가 취소됐어요'));
      }
      return task();
    },
  );
  captureQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

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

function frameRect(pageW = BOOK_W, pageH = BOOK_H) {
  const x = Math.round(pageW * FRAME_PAD_X);
  const y = Math.round(pageH * FRAME_PAD_Y);
  return {
    x,
    y,
    w: pageW - x * 2,
    h: pageH - y * 2,
  };
}

export type BookSlot = { x: number; y: number; w: number; h: number };

export function paperSlotInBook(
  iw: number,
  ih: number,
  pageW = BOOK_W,
  pageH = BOOK_H,
): BookSlot {
  const frame = frameRect(pageW, pageH);
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
  pageW = BOOK_W,
  pageH = BOOK_H,
) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, pageW, pageH);

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
  pageW = BOOK_W,
  pageH = BOOK_H,
): BookSlot {
  const slot = paperSlotInBook(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    pageW,
    pageH,
  );
  ctx.save();
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, FRAME_R);
  ctx.clip();
  ctx.drawImage(img, slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
  return slot;
}

function createPageCanvas(
  pageW = BOOK_W,
  pageH = BOOK_H,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = pageW;
  canvas.height = pageH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('일기장 페이지를 만들 수 없어요');
  return { canvas, ctx };
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
  /** PDF 등 — 1페이지 일기 paper와 같은 안쪽 영역 */
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

  const inner = options?.slot ?? frameRect();
  const frame = drawBookFrame(ctx, bg, surface, border, inner);
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

export async function renderEntryBookPage(
  entry: DiaryEntry,
  captureOptions?: CapturePaperOptions,
  pageSize?: { w: number; h: number },
): Promise<BookPage> {
  const run = async () => {
    const pageW = pageSize?.w ?? BOOK_W;
    const pageH = pageSize?.h ?? BOOK_H;
    const paperBlob = await captureDiaryEntryPaperBlob(entry, null, {
      ...BOOK_CAPTURE,
      ...captureOptions,
    });
    const paperUrl = URL.createObjectURL(paperBlob);
    try {
      const img = await loadImage(paperUrl);
      const { canvas, ctx } = createPageCanvas(pageW, pageH);
      const bg = themeColor('--color-bg', '#ffffff');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, pageW, pageH);
      const slot = fillImageInFrame(ctx, img, pageW, pageH);

      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
      const page = await pageFromBlob(blob, entry.title || formatDate(entry.date));
      return { ...page, slot };
    } finally {
      URL.revokeObjectURL(paperUrl);
    }
  };

  // 한 장씩 큐. 타임아웃은 “대기”만 끊지 않고, 실제 작업이 끝날 때까지 큐를 점유
  return enqueueCapture(async () => {
    const work = run();
    try {
      return await withTimeout(
        work,
        45_000,
        '일기 페이지를 만드는 데 시간이 너무 걸려요',
      );
    } catch (err) {
      // 타임아웃 후에도 백그라운드 work가 끝날 때까지 기다려 다음 장과 겹치지 않게
      await Promise.race([
        work.then(
          () => undefined,
          () => undefined,
        ),
        new Promise<void>((r) => window.setTimeout(r, 5_000)),
      ]);
      throw err;
    }
  });
}

/** 이미지에 바깥 여백 + @PageBy 푸터 (SNS 공유·캔버스 다운로드 공통) */
export async function stampPageByOnImage(
  source: Blob | string,
  options?: { type?: string; quality?: number },
): Promise<Blob> {
  const type = options?.type ?? 'image/jpeg';
  const quality = options?.quality ?? 0.92;
  const objectUrl =
    typeof source === 'string'
      ? null
      : URL.createObjectURL(source);
  try {
    const img =
      typeof source === 'string'
        ? await loadImageSafe(source)
        : await loadImage(objectUrl!);
    const pw = Math.max(1, img.naturalWidth || img.width);
    const ph = Math.max(1, img.naturalHeight || img.height);
    const margin = Math.max(28, Math.round(Math.min(pw, ph) * 0.06));
    const footerH = Math.max(32, Math.round(ph * 0.045));
    const canvasW = pw + margin * 2;
    const canvasH = ph + margin * 2 + footerH;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지를 만들 수 없어요');

    const outerBg = themeColor('--color-bg', '#f7f6f4');
    ctx.fillStyle = outerBg;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, margin, margin, pw, ph);

    const fontSize = Math.max(15, Math.round(pw * 0.036));
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = themeColor('--color-text-muted', '#6b6b6b');
    ctx.fillText('@PageBy', canvasW - margin, margin + ph + footerH / 2);

    return canvasToBlob(canvas, type, quality);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** SNS(인스타 등) 공유 — 일기 paper + 바깥 여백 + @PageBy (실제 일기 크기) */
export async function renderSnsSharePage(entry: DiaryEntry): Promise<BookPage> {
  const run = async () => {
    const paperBlob = await captureDiaryEntryPaperBlob(entry, null, SNS_CAPTURE);
    const stamped = await stampPageByOnImage(paperBlob, {
      type: SNS_CAPTURE.type ?? 'image/jpeg',
      quality: SNS_CAPTURE.quality ?? 0.92,
    });
    return pageFromBlob(stamped, entry.title || formatDate(entry.date));
  };

  return enqueueCapture(async () => {
    const work = run();
    try {
      return await withTimeout(
        work,
        45_000,
        '일기 페이지를 만드는 데 시간이 너무 걸려요',
      );
    } catch (err) {
      await Promise.race([
        work.then(
          () => undefined,
          () => undefined,
        ),
        new Promise<void>((r) => window.setTimeout(r, 5_000)),
      ]);
      throw err;
    }
  });
}

/** 표지 + 일기 페이지들 (날짜 오름차순) — PDF 등에서 전부 필요할 때 */
export async function buildBookPages(entries: DiaryEntry[]): Promise<BookPage[]> {
  if (entries.length === 0) throw new Error('다운로드할 일기가 없어요');

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const rest: BookPage[] = [];
  for (const entry of sorted) {
    rest.push(await renderSnsSharePage(entry));
  }
  const cover = await renderCoverBookPage(sorted);
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
    await appendBookPageToPdf(pdf, page, i === 0);
    if (i % 4 === 3) {
      await new Promise<void>((r) => window.setTimeout(r, 0));
    }
  }

  return pdf.output('blob');
}

async function appendBookPageToPdf(
  pdf: InstanceType<typeof jsPDF>,
  page: BookPage,
  isFirst: boolean,
): Promise<void> {
  const w = page.width;
  const h = page.height;
  if (!isFirst) {
    pdf.addPage([w, h], w >= h ? 'landscape' : 'portrait');
  }
  // dataURL base64 변환은 느리고 메모리를 두 배로 씀 → blob URL 이미지 직접 사용
  const img = await loadImage(page.blobUrl);
  const format = page.blob.type.includes('png') ? 'PNG' : 'JPEG';
  pdf.addImage(img, format, 0, 0, w, h);
}

/** PDF용 SNS 구도 페이지 (큐 우회 — buildStreamingDiaryPdf 가 이미 직렬) */
async function renderPdfSharePage(entry: DiaryEntry): Promise<BookPage> {
  const work = (async () => {
    const paperBlob = await captureDiaryEntryPaperBlob(entry, null, BOOK_PDF_CAPTURE);
    const stamped = await stampPageByOnImage(paperBlob, {
      type: BOOK_PDF_CAPTURE.type ?? 'image/jpeg',
      quality: BOOK_PDF_CAPTURE.quality ?? 0.84,
    });
    return pageFromBlob(stamped, entry.title || formatDate(entry.date));
  })();
  try {
    return await withTimeout(
      work,
      40_000,
      '일기 페이지를 만드는 데 시간이 너무 걸려요',
    );
  } catch (err) {
    await Promise.race([
      work.then(
        () => undefined,
        () => undefined,
      ),
      new Promise<void>((r) => window.setTimeout(r, 3_000)),
    ]);
    throw err;
  }
}

/**
 * 유료 PDF — 표지 + SNS와 같은 구도 일기 페이지 (빠른 캡처).
 * 한 장 렌더 → PDF에 넣고 즉시 메모리 해제. 다음 장 캡처는 파이프라인.
 */
export async function buildStreamingDiaryPdf(
  entries: DiaryEntry[],
  options?: {
    avatarUrl?: string | null;
    rangeStart?: string;
    rangeEnd?: string;
    onProgress?: (current: number, total: number) => void;
  },
): Promise<Blob> {
  if (entries.length === 0) throw new Error('다운로드할 일기가 없어요');

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const total = sorted.length;
  await drainBookCaptureQueue();

  const fontIds = [...new Set(sorted.map((e) => e.fontId).filter(Boolean))];
  await Promise.all(
    fontIds.map((id) => ensureDiaryFontReady(id).catch(() => undefined)),
  );

  const yieldToMain = () =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });

  // 표지는 슬롯 맞추기용 풀캡처 없이 바로 생성 (장당 1회 절약)
  const cover = await renderCoverBookPage(sorted, {
    avatarUrl: options?.avatarUrl,
    rangeStart: options?.rangeStart,
    rangeEnd: options?.rangeEnd,
  });

  let coverPage: BookPage | null = cover;
  const pdf = new jsPDF({
    orientation: cover.width >= cover.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [cover.width, cover.height],
    hotfixes: ['px_scaling'],
  });

  try {
    await appendBookPageToPdf(pdf, coverPage, true);
    revokeBookPage(coverPage);
    coverPage = null;

    // 캡처는 한 장만: 다음 장 캡처 ↔ 현재 장 PDF 삽입을 겹침
    let page = await renderPdfSharePage(sorted[0]);
    for (let i = 0; i < sorted.length; i += 1) {
      options?.onProgress?.(i + 1, total);
      const nextPromise =
        i + 1 < sorted.length ? renderPdfSharePage(sorted[i + 1]) : null;
      try {
        await appendBookPageToPdf(pdf, page, false);
      } finally {
        revokeBookPage(page);
      }
      await yieldToMain();
      if (nextPromise) {
        page = await nextPromise;
      }
    }

    return pdf.output('blob');
  } finally {
    if (coverPage) revokeBookPage(coverPage);
  }
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
