import { materializeImageSrc } from './materializeImage';

/** AI 그림 바깥 흰·크림 여백만 잘라 내용 bounds에 맞춤 (레이어 박스 축소는 하지 않음) */

function colorDist(
  r: number,
  g: number,
  b: number,
  br: number,
  bg: number,
  bb: number,
): number {
  return Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
}

function isMarginPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: { r: number; g: number; b: number },
): boolean {
  if (a < 12) return true;
  // 순백·미색 (JPEG 노이즈 여유)
  if (
    r >= 238 &&
    g >= 238 &&
    b >= 238 &&
    Math.max(r, g, b) - Math.min(r, g, b) <= 14
  ) {
    return true;
  }
  // 모서리에서 추정한 종이색과 매우 비슷하고, 충분히 밝은 픽셀만 여백
  const lum = r + g + b;
  if (lum < 660) return false;
  return colorDist(r, g, b, bg.r, bg.g, bg.b) <= 40;
}

function sampleBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const points: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
    [3, 3],
    [width - 4, 3],
    [3, height - 4],
    [width - 4, height - 4],
  ];
  const samples: Array<{ r: number; g: number; b: number; lum: number }> = [];
  for (const [x, y] of points) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = (y * width + x) * 4;
    if (data[i + 3] < 12) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    samples.push({ r, g, b, lum: r + g + b });
  }
  if (samples.length === 0) return { r: 255, g: 255, b: 255 };
  samples.sort((a, b) => b.lum - a.lum);
  const keep = samples.slice(0, Math.max(4, Math.ceil(samples.length * 0.7)));
  let r = 0;
  let g = 0;
  let b = 0;
  for (const s of keep) {
    r += s.r;
    g += s.g;
    b += s.b;
  }
  const n = keep.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/**
 * 가장자리에서 안쪽으로만 스캔 — 연속된 여백 띠만 제거.
 * (그림 안쪽 밝은 부분까지 파고들지 않음)
 */
function findOuterMarginBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
): { left: number; top: number; right: number; bottom: number } | null {
  const stepX = Math.max(1, Math.floor(width / 320));
  const stepY = Math.max(1, Math.floor(height / 320));
  // 행/열이 "여백"이려면 샘플의 이 비율 이상이 여백이어야 함
  const emptyRowThreshold = 0.97;
  const emptyColThreshold = 0.97;

  const isEmptyRow = (y: number): boolean => {
    let empty = 0;
    let total = 0;
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      total += 1;
      if (isMarginPixel(data[i], data[i + 1], data[i + 2], data[i + 3], bg)) {
        empty += 1;
      }
    }
    return total > 0 && empty / total >= emptyRowThreshold;
  };

  const isEmptyCol = (x: number): boolean => {
    let empty = 0;
    let total = 0;
    for (let y = 0; y < height; y += stepY) {
      const i = (y * width + x) * 4;
      total += 1;
      if (isMarginPixel(data[i], data[i + 1], data[i + 2], data[i + 3], bg)) {
        empty += 1;
      }
    }
    return total > 0 && empty / total >= emptyColThreshold;
  };

  let top = 0;
  while (top < height - 1 && isEmptyRow(top)) top += 1;

  let bottom = height - 1;
  while (bottom > top && isEmptyRow(bottom)) bottom -= 1;

  let left = 0;
  while (left < width - 1 && isEmptyCol(left)) left += 1;

  let right = width - 1;
  while (right > left && isEmptyCol(right)) right -= 1;

  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

function trimFromDataUrl(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width < 2 || height < 2) {
          resolve(src);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, width, height);
        const bg = sampleBackground(data, width, height);
        const bounds = findOuterMarginBounds(data, width, height, bg);

        if (!bounds) {
          resolve(src);
          return;
        }

        let { left, top, right, bottom } = bounds;

        // 바깥 여백만 잘렸는지 — 너무 적으면 스킵, 과하면(그림 잠식) 스킵
        const cropW = right - left + 1;
        const cropH = bottom - top + 1;
        const areaRatio = (cropW * cropH) / (width * height);
        if (areaRatio > 0.995) {
          resolve(src);
          return;
        }
        // 내용이 원본의 35% 미만이면 오검으로 보고 원본 유지
        if (areaRatio < 0.35 || cropW < 16 || cropH < 16) {
          resolve(src);
          return;
        }

        const pad = Math.max(2, Math.round(Math.max(cropW, cropH) * 0.008));
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(width - 1, right + pad);
        bottom = Math.min(height - 1, bottom + pad);

        const outW = right - left + 1;
        const outH = bottom - top + 1;
        const out = document.createElement('canvas');
        out.width = outW;
        out.height = outH;
        const outCtx = out.getContext('2d');
        if (!outCtx) {
          resolve(src);
          return;
        }
        outCtx.drawImage(canvas, left, top, outW, outH, 0, 0, outW, outH);
        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

/**
 * AI PNG 바깥 여백만 제거한 data URL.
 * 실패·변화 미미·과하면 원본 반환.
 */
export async function trimDrawingToContent(src: string): Promise<string> {
  let safe = src.trim();
  if (!safe) return src;
  try {
    safe = await materializeImageSrc(safe, { fallbackToOriginal: false });
  } catch {
    if (
      !safe.startsWith('data:') &&
      !safe.startsWith('blob:') &&
      !safe.startsWith('/')
    ) {
      return src;
    }
  }
  return trimFromDataUrl(safe);
}
