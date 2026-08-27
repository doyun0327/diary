import { trimDrawingForThumb } from './trimDrawingForThumb';

const SHARE_MAX_EDGE = 960;
const SHARE_JPEG_QUALITY = 0.82;

/** 개인 일기 localStorage용 — 여백 trim + JPEG (용량 초과로 재시작 후 그림 소실 방지) */
const DIARY_MAX_EDGE = 1024;
const DIARY_JPEG_QUALITY = 0.8;

/** 친구방 공유용 — 여백 trim + JPEG 리사이즈로 업로드 크기 축소 */
export async function compressDataUrlForShare(
  src: string | undefined | null,
): Promise<string | undefined> {
  if (!src?.trim()) return undefined;
  try {
    const trimmed = await trimDrawingForThumb(src.trim());
    return await resizeToJpeg(trimmed, SHARE_MAX_EDGE, SHARE_JPEG_QUALITY);
  } catch {
    return src.trim();
  }
}

/** 일기 저장용. PNG 원본은 localStorage 한도를 쉽게 넘김 */
export async function compressDataUrlForDiary(
  src: string | undefined | null,
): Promise<string | undefined> {
  if (!src?.trim()) return undefined;
  try {
    const trimmed = await trimDrawingForThumb(src.trim());
    return await resizeToJpeg(trimmed, DIARY_MAX_EDGE, DIARY_JPEG_QUALITY);
  } catch {
    return src.trim();
  }
}

function resizeToJpeg(
  src: string,
  maxEdge: number,
  quality: number,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || img.width;
      const h0 = img.naturalHeight || img.height;
      if (w0 < 2 || h0 < 2) {
        resolve(src);
        return;
      }
      const scale = Math.min(1, maxEdge / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      if (scale >= 1 && src.startsWith('data:image/jpeg')) {
        resolve(src);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
