/**
 * 냥티켓·앱 소개용 public/intro 이미지.
 * 앱 기동 시 Cache Storage(+ blob URL)에 올려 시트 열 때 네트워크 재요청을 줄임.
 */

export const NYANG_TICKET_INTRO_FILES = [
  '50장.png',
  'pdf저장.png',
  '검색.png',
  '광고제거.png',
] as const;

const NYANG_TICKET_IMAGE_CACHE = 'nyang-ticket-intro-v1';

const blobUrlByFile = new Map<string, string>();
const readyListeners = new Set<() => void>();
let warmPromise: Promise<void> | null = null;

export function nyangTicketIntroPath(file: string): string {
  return `/intro/${encodeURIComponent(file)}`;
}

function notifyReady() {
  readyListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** 캐시된 blob URL. 없으면 path (네트워크/브라우저 캐시). */
export function nyangTicketIntroSrc(file: string): string {
  return blobUrlByFile.get(file) ?? nyangTicketIntroPath(file);
}

export function subscribeNyangTicketImagesReady(listener: () => void): () => void {
  readyListeners.add(listener);
  if (blobUrlByFile.size > 0) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
  return () => {
    readyListeners.delete(listener);
  };
}

async function putBlob(file: string, res: Response) {
  try {
    const blob = await res.blob();
    if (!blob.size) return;
    const prev = blobUrlByFile.get(file);
    if (prev) URL.revokeObjectURL(prev);
    blobUrlByFile.set(file, URL.createObjectURL(blob));
  } catch {
    /* ignore */
  }
}

/** 앱 최초 유휴 시 호출 — intro 혜택 이미지 캐시 */
export function preloadNyangTicketImages() {
  if (warmPromise) return warmPromise;

  warmPromise = (async () => {
    const files = [...NYANG_TICKET_INTRO_FILES];

    if (typeof caches === 'undefined') {
      await Promise.all(
        files.map(async (file) => {
          if (blobUrlByFile.has(file)) return;
          try {
            const res = await fetch(nyangTicketIntroPath(file));
            if (res.ok) await putBlob(file, res);
          } catch {
            /* ignore */
          }
        }),
      );
      notifyReady();
      return;
    }

    try {
      const cache = await caches.open(NYANG_TICKET_IMAGE_CACHE);
      await Promise.all(
        files.map(async (file) => {
          if (blobUrlByFile.has(file)) return;
          const path = nyangTicketIntroPath(file);
          let res =
            (await cache.match(path)) ||
            (await cache.match(`/intro/${file}`)) ||
            (await cache.match(encodeURI(`/intro/${file}`)));

          if (!res || !res.ok) {
            try {
              const fetched = await fetch(path);
              if (fetched.ok) {
                await cache.put(path, fetched.clone());
                res = fetched;
              }
            } catch {
              return;
            }
          }
          if (res?.ok) await putBlob(file, res);
        }),
      );
    } catch {
      for (const file of files) {
        if (blobUrlByFile.has(file)) continue;
        try {
          const res = await fetch(nyangTicketIntroPath(file));
          if (res.ok) await putBlob(file, res);
        } catch {
          /* ignore */
        }
      }
    }

    notifyReady();
  })();

  return warmPromise;
}
