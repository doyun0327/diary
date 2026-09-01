const cache = new Map<string, string>();
const MAX_CACHE = 80;

function isNearWhite(r: number, g: number, b: number, a: number): boolean {
  if (a < 12) return true;
  return r >= 248 && g >= 248 && b >= 248;
}

function rowMostlyBlank(
  data: Uint8ClampedArray,
  width: number,
  y: number,
  threshold = 0.985,
): boolean {
  let blank = 0;
  const row = y * width;
  for (let x = 0; x < width; x++) {
    const i = (row + x) * 4;
    if (isNearWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) blank += 1;
  }
  return blank / width >= threshold;
}

export function cropBottomWhitespaceCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width < 8 || canvas.height < 8) return canvas;

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const maxCrop = Math.min(Math.floor(height * 0.22), Math.floor(width * 0.18));
  let cropRows = 0;

  for (let y = height - 1; y >= height - maxCrop && y >= 0; y--) {
    if (!rowMostlyBlank(data, width, y)) break;
    cropRows += 1;
  }

  if (cropRows < 6) return canvas;

  const outH = height - cropRows;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = outH;
  out.getContext('2d')?.drawImage(canvas, 0, 0, width, outH, 0, 0, width, outH);
  return out;
}

/** 그림 하단의 흰 여백(구 도구줄 영역 등)을 잘라 표시·저장 비율을 맞춤 */
export function cropDrawingBottomWhitespace(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width < 8 || height < 8) {
          resolve(src);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const cropped = cropBottomWhitespaceCanvas(canvas);
        if (cropped === canvas) {
          cache.set(src, src);
          resolve(src);
          return;
        }
        const out = cropped.toDataURL('image/png');

        if (cache.size >= MAX_CACHE) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
        cache.set(src, out);
        resolve(out);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
