/** 흰 여백을 잘라 달력 썸네일에서 그림이 더 크게 보이게 함 */
const cache = new Map<string, string>();
const MAX_CACHE = 100;

function isNearWhite(r: number, g: number, b: number, a: number): boolean {
  if (a < 12) return true;
  return r >= 248 && g >= 248 && b >= 248;
}

export function trimDrawingForThumb(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        if (canvas.width < 2 || canvas.height < 2) {
          resolve(src);
          return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let top = height;
        let left = width;
        let right = -1;
        let bottom = -1;

        for (let y = 0; y < height; y++) {
          const row = y * width;
          for (let x = 0; x < width; x++) {
            const i = (row + x) * 4;
            if (isNearWhite(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }

        if (right < left || bottom < top) {
          cache.set(src, src);
          resolve(src);
          return;
        }

        const pad = Math.max(
          4,
          Math.round(Math.max(right - left + 1, bottom - top + 1) * 0.06),
        );
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(width - 1, right + pad);
        bottom = Math.min(height - 1, bottom + pad);

        const cropW = right - left + 1;
        const cropH = bottom - top + 1;
        const out = document.createElement('canvas');
        out.width = cropW;
        out.height = cropH;
        const outCtx = out.getContext('2d');
        if (!outCtx) {
          resolve(src);
          return;
        }
        outCtx.fillStyle = '#ffffff';
        outCtx.fillRect(0, 0, cropW, cropH);
        outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);

        const trimmed = out.toDataURL('image/jpeg', 0.85);
        if (cache.size >= MAX_CACHE) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
        cache.set(src, trimmed);
        resolve(trimmed);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
