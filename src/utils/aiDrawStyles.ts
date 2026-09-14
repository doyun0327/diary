/**
 * AI 그림 스타일 — 사진 기반, 전부 GPT Image 2 (reference) 경로.
 * webtoonHero | oilPastel | jpRetroFilm
 */

export type AiDrawStyleId = 'webtoonHero' | 'oilPastel' | 'jpRetroFilm';

/** 웹툰주인공 st */
export const WEBTOON_HERO_STYLE_PROMPT =
  'A casual, expressive hand-drawn anime-inspired illustration with a strong sense of personality. Simplified and slightly exaggerated character proportions, simple facial features, expressive eyes, and loosely drawn hair. The illustration should feel spontaneous and artistic rather than polished or perfectly designed. Bold, slightly imperfect black outlines with visible hand-drawn energy. Large areas of flat color with very minimal shading, simple color shapes, and subtle soft texture. Minimal and simple background. Dynamic close-up composition with the character filling most of the frame. A stylish, youthful, nostalgic illustration with a playful and effortlessly cool feeling. Use a cohesive and expressive color palette that can change freely depending on the image, while maintaining a bold, simple, artistic atmosphere. Avoid poster design, editorial illustration, realistic anatomy, cinematic lighting, detailed backgrounds, and overly polished rendering.';

/** 오일파스텔 st */
export const OIL_PASTEL_STYLE_PROMPT = [
  'Redraw the attached photo as a thick oil-pastel doodle on white paper.',
  'Simple round face, bright expression, eyes as two small dots, minimal nose and mouth.',
  'Chibi 3-head proportions — big head, small awkward body, stick arms and legs.',
  'Clumsy but the photo scene must stay recognizable.',
  'Almost no coloring — only key areas roughly smeared with oil pastel / crayon.',
  'Chunky grainy pastel texture, uneven fills with bare paper showing through.',
  'Forbidden: clean digital drawing, webtoon, polished illustration, overly cute refinement.',
  'Keep finish intentionally low; thick lines; unify arm and leg stroke style.',
].join(' ');

/** 일본 레트로 영화풍 st */
export const JP_RETRO_FILM_STYLE_PROMPT =
  'A stylish and emotional retro Japanese anime illustration with simple yet expressive linework and soft flat coloring. A carefully balanced, artistic color palette with subtle color bleeding and slightly grainy analog texture. Dreamy, nostalgic, and cinematic atmosphere. Minimal background and character-focused composition. Vintage anime and analog illustration aesthetic. The color palette can vary freely depending on the mood of the scene while maintaining the same nostalgic, dreamy, stylish emotional atmosphere. CRITICAL: Absolutely no writing anywhere in the image — no Japanese, Chinese, Korean, English, or any other language; no kanji, hiragana, katakana, hangul, letters, numbers, signs, posters, captions, speech bubbles, watermarks, logos, or labels.';

export const AI_DRAW_STYLES: {
  id: AiDrawStyleId;
  previewSrcs: string[];
  enabled: boolean;
}[] = [
  {
    id: 'webtoonHero',
    enabled: true,
    previewSrcs: ['/preview/final_웹툰.jpg'],
  },
  {
    id: 'oilPastel',
    enabled: true,
    previewSrcs: ['/preview/final_오일.jpg'],
  },
  {
    id: 'jpRetroFilm',
    enabled: true,
    previewSrcs: ['/preview/final_일본.jpg'],
  },
];

const AI_STYLE_PREVIEW_CACHE = 'ai-style-previews-v8';
/** path → blob: URL. UI는 이걸로만 표시해 네트워크 재요청을 막음 */
const previewBlobUrlBySrc = new Map<string, string>();
const previewReadyListeners = new Set<() => void>();
let previewWarmPromise: Promise<void> | null = null;

function previewRequestUrl(path: string): string {
  try {
    return new URL(path, typeof location !== 'undefined' ? location.origin : 'https://local').href;
  } catch {
    return path;
  }
}

function notifyAiStylePreviewsReady() {
  previewReadyListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** 스타일 미리보기 src — 캐시 blob만 반환 (없으면 빈 문자열 → 네트워크 금지) */
export function aiStylePreviewSrc(path: string): string {
  return previewBlobUrlBySrc.get(path) ?? '';
}

export function subscribeAiStylePreviewsReady(listener: () => void): () => void {
  previewReadyListeners.add(listener);
  if (previewBlobUrlBySrc.size > 0) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
  return () => {
    previewReadyListeners.delete(listener);
  };
}

async function putPreviewBlob(path: string, res: Response) {
  try {
    const blob = await res.blob();
    if (!blob.size) return;
    const prev = previewBlobUrlBySrc.get(path);
    if (prev) URL.revokeObjectURL(prev);
    previewBlobUrlBySrc.set(path, URL.createObjectURL(blob));
  } catch {
    /* ignore */
  }
}

/**
 * 앱 최초(캐시 비어 있을 때)만 네트워크로 받아 Cache Storage에 저장.
 * 이후에는 캐시 → blob URL만 사용 (미리보기 img 재요청 없음).
 */
export function preloadAiStylePreviews() {
  if (previewWarmPromise) return previewWarmPromise;

  previewWarmPromise = (async () => {
    // UI는 스타일당 대표 1장만 쓰므로 커버만 프리로드
    const paths = AI_DRAW_STYLES.map((style) => style.previewSrcs[0]).filter(
      Boolean,
    ) as string[];
    if (paths.length === 0) return;

    if (typeof caches === 'undefined') {
      for (const src of paths) {
        if (previewBlobUrlBySrc.has(src)) continue;
        try {
          const res = await fetch(previewRequestUrl(src));
          if (res.ok) await putPreviewBlob(src, res);
        } catch {
          /* ignore */
        }
      }
      notifyAiStylePreviewsReady();
      return;
    }

    try {
      const cache = await caches.open(AI_STYLE_PREVIEW_CACHE);
      await Promise.all(
        paths.map(async (path) => {
          const reqUrl = previewRequestUrl(path);
          let res =
            (await cache.match(reqUrl)) ||
            (await cache.match(path)) ||
            (await cache.match(encodeURI(path)));

          if (!res) {
            try {
              const fetched = await fetch(reqUrl);
              if (!fetched.ok) return;
              await cache.put(reqUrl, fetched.clone());
              res = fetched;
            } catch {
              return;
            }
          }

          await putPreviewBlob(path, res);
        }),
      );
    } catch {
      /* ignore */
    }

    notifyAiStylePreviewsReady();
  })();

  return previewWarmPromise;
}

export function isAiDrawStyleEnabled(styleId: AiDrawStyleId): boolean {
  return AI_DRAW_STYLES.find((s) => s.id === styleId)?.enabled !== false;
}

export function stylePromptFor(styleId: AiDrawStyleId): string {
  switch (styleId) {
    case 'oilPastel':
      return OIL_PASTEL_STYLE_PROMPT;
    case 'jpRetroFilm':
      return JP_RETRO_FILM_STYLE_PROMPT;
    case 'webtoonHero':
    default:
      return WEBTOON_HERO_STYLE_PROMPT;
  }
}

/** 레거시 id → 현재 id */
export function normalizeAiDrawStyleId(raw: string | null | undefined): AiDrawStyleId {
  const s = (raw ?? '').trim();
  if (s === 'oilPastel' || s === 'oil_pastel' || s === 'oil-pastel') return 'oilPastel';
  if (s === 'jpRetroFilm' || s === 'jpRetro' || s === 'retroFilm') return 'jpRetroFilm';
  // cartoonChar / kidSketch / storybook → 웹툰주인공
  return 'webtoonHero';
}

/** AI 참조용 사진 → JPEG data URL */
export function fileToAiReferenceDataUrl(
  file: File,
  maxEdge = 1280,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('image-only'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const src = String(reader.result ?? '');
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas-failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('load-failed'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
