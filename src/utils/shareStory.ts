import type { DiaryEntry } from '../types/diary';
import { MOOD_MAP } from '../types/diary';
import { formatDate } from './date';

const STORY_W = 1080;
const STORY_H = 1920;

export type ShareTarget = 'sns';

export type ShareResult =
  | 'shared'
  | 'downloaded'
  | { type: 'downloaded'; previewUrl: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('그림을 불러오지 못했어요'));
    img.src = src;
  });
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

function getDiaryFont(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--diary-font')
    .trim();
  return raw || '"Gaegu", "Apple SD Gothic Neo", sans-serif';
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

/** 공유용 9:16 카드 이미지 */
export async function buildDiaryStoryBlob(entry: DiaryEntry): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = STORY_W;
  canvas.height = STORY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('공유 이미지를 만들 수 없어요');

  const fontFamily = getDiaryFont();

  const bg = ctx.createLinearGradient(0, 0, 0, STORY_H);
  bg.addColorStop(0, '#fff9f0');
  bg.addColorStop(0.55, '#fff4e6');
  bg.addColorStop(1, '#ffe8cc');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_W, STORY_H);

  const cardX = 72;
  const cardY = 160;
  const cardW = STORY_W - cardX * 2;
  const cardH = STORY_H - 320;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const pad = 56;
  let y = cardY + pad;

  const mood = MOOD_MAP[entry.mood];
  ctx.fillStyle = '#868e96';
  ctx.font = `500 36px ${fontFamily}`;
  ctx.fillText(formatDate(entry.date), cardX + pad, y + 36);
  const moodText = `${mood.emoji} ${mood.label}`;
  ctx.font = `40px ${fontFamily}`;
  const moodWidth = ctx.measureText(moodText).width;
  ctx.fillText(moodText, cardX + cardW - pad - moodWidth, y + 36);
  y += 80;

  ctx.strokeStyle = '#eee3cf';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cardX + pad, y);
  ctx.lineTo(cardX + cardW - pad, y);
  ctx.stroke();
  y += 48;

  if (entry.title.trim()) {
    ctx.fillStyle = '#212529';
    ctx.font = `700 56px ${fontFamily}`;
    const titleLines = wrapText(ctx, entry.title.trim(), cardW - pad * 2, 2);
    for (const line of titleLines) {
      ctx.fillText(line, cardX + pad, y + 48);
      y += 68;
    }
    y += 16;
  }

  if (entry.imageUrl) {
    try {
      const img = await loadImage(entry.imageUrl);
      const maxW = cardW - pad * 2;
      const maxH = 720;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = cardX + (cardW - dw) / 2;
      roundRect(ctx, dx - 4, y - 4, dw + 8, dh + 8, 24);
      ctx.fillStyle = '#f8f9fa';
      ctx.fill();
      ctx.drawImage(img, dx, y, dw, dh);
      y += dh + 40;
    } catch {
      // ignore
    }
  }

  if (entry.content.trim()) {
    ctx.fillStyle = '#495057';
    ctx.font = `400 42px ${fontFamily}`;
    const remain = Math.max(3, Math.floor((cardY + cardH - pad - y) / 58));
    const lines = wrapText(ctx, entry.content.trim(), cardW - pad * 2, remain);
    for (const line of lines) {
      ctx.fillText(line, cardX + pad, y + 40);
      y += 58;
    }
  }

  ctx.fillStyle = '#adb5bd';
  ctx.font = `600 32px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillText('diary', STORY_W / 2, STORY_H - 80);
  ctx.textAlign = 'left';

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) throw new Error('공유 이미지 변환에 실패했어요');
  return blob;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // URL은 미리보기에서도 쓸 수 있어 호출측에서 revoke
  return url;
}

/** 모바일에서 파일 공유(Web Share) 지원 여부 — PC 웹은 보통 false */
export function canShareImageFile(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'p.png', {
      type: 'image/png',
    });
    if (typeof navigator.canShare === 'function') {
      return navigator.canShare({ files: [probe] });
    }
    // canShare 없는 일부 모바일은 share만 시도
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

async function tryNativeShare(file: File, title: string, text: string): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false;

  const payload = { files: [file], title, text };
  const ok =
    typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
  if (!ok) return false;

  try {
    await navigator.share(payload);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return false;
  }
}

/**
 * SNS 공유 (인스타·카카오톡 등 시스템 공유 시트)
 * - 폰: 시스템 공유 시트 → 원하는 앱 선택
 * - PC 웹: 이미지 다운로드 (앱 공유 API 미지원)
 */
export async function shareDiaryTo(
  entry: DiaryEntry,
  _target: ShareTarget = 'sns',
): Promise<{ result: 'shared' | 'downloaded'; previewUrl?: string; isMobileShare: boolean }> {
  const blob = await buildDiaryStoryBlob(entry);
  const filename = `diary-${entry.date}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const title = entry.title || 'diary';
  const text = '내 diary를 SNS로 공유해요';

  const isMobileShare = canShareImageFile();

  if (isMobileShare) {
    const shared = await tryNativeShare(file, title, text);
    if (shared) {
      return { result: 'shared', isMobileShare: true };
    }
  }

  const previewUrl = downloadBlob(blob, filename);
  return { result: 'downloaded', previewUrl, isMobileShare };
}
