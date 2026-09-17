/**
 * 원격 이미지를 same-origin 취급 data URL로 바꿔 캔버스 export(toDataURL)가
 * tainted SecurityError 나지 않게 합니다.
 * data:/blob: 은 그대로 둡니다.
 *
 * @param fallbackToOriginal CORS 실패 시 원본 URL 반환(화면 표시용)
 */
export async function materializeImageSrc(
  src: string,
  opts?: { fallbackToOriginal?: boolean; timeoutMs?: number },
): Promise<string> {
  const trimmed = src.trim();
  if (!trimmed) {
    throw new Error('이미지 주소가 비어 있어요');
  }
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(trimmed, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'force-cache',
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    try {
      return await loadViaImageElement(trimmed, timeoutMs);
    } catch (err) {
      if (opts?.fallbackToOriginal) return trimmed;
      throw err;
    }
  } finally {
    window.clearTimeout(timer);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
    reader.readAsDataURL(blob);
  });
}

function loadViaImageElement(src: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };
    const timer = window.setTimeout(() => {
      finish(() =>
        reject(new Error('원격 그림을 불러오지 못했어요. 시간이 초과됐어요')),
      );
    }, timeoutMs);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      finish(() => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('이미지 변환에 실패했어요'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          reject(
            new Error(
              '그림 저장을 위해 이미지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요',
            ),
          );
        }
      });
    };
    img.onerror = () =>
      finish(() =>
        reject(
          new Error(
            '원격 그림을 불러오지 못했어요. 네트워크 또는 이미지 권한을 확인해 주세요',
          ),
        ),
      );
    img.src = src;
  });
}
