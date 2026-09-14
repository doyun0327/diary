/**
 * AI 그림 스타일
 * - 사진 경로: webtoonHero | oilPastel | jpRetroFilm (GPT Image 2 + reference)
 * - 일기 텍스트 경로: textOil (예전 오일파스텔·diaryLine, 사진 없음)
 */

/** 사진 첨부 생성용 — AI_DRAW_STYLES 에만 포함 */
export type AiPhotoDrawStyleId = 'webtoonHero' | 'oilPastel' | 'jpRetroFilm';

/** 전체 스타일 id (일기 textOil 포함) */
export type AiDrawStyleId = AiPhotoDrawStyleId | 'textOil';

/** 웹툰주인공 st */
export const WEBTOON_HERO_STYLE_PROMPT =
  'A casual, expressive hand-drawn anime-inspired illustration with a strong sense of personality. Simplified and slightly exaggerated character proportions, simple facial features, expressive eyes, and loosely drawn hair. The illustration should feel spontaneous and artistic rather than polished or perfectly designed. Bold, slightly imperfect black outlines with visible hand-drawn energy. Large areas of flat color with very minimal shading, simple color shapes, and subtle soft texture. Minimal and simple background. Dynamic close-up composition with the character filling most of the frame. A stylish, youthful, nostalgic illustration with a playful and effortlessly cool feeling. Use a cohesive and expressive color palette that can change freely depending on the image, while maintaining a bold, simple, artistic atmosphere. Avoid poster design, editorial illustration, realistic anatomy, cinematic lighting, detailed backgrounds, and overly polished rendering.';

/** 오일파스텔 st (사진 첨부용 — 변경하지 말 것) */
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

/**
 * 일기 텍스트 → 오일파스텔 스타일 id.
 * 프롬프트는 서버 buildOilPastelImagePrompt 만 사용 (프론트 미전송).
 */
export const TEXT_OIL_STYLE_ID = 'textOil' as const;

export const AI_DRAW_STYLES: {
  id: AiPhotoDrawStyleId;
  previewSrcs: string[];
  enabled: boolean;
}[] = [
  {
    id: 'webtoonHero',
    enabled: true,
    previewSrcs: ['/preview/final_webtoon.jpg'],
  },
  {
    id: 'oilPastel',
    enabled: true,
    previewSrcs: ['/preview/final_oil.jpg'],
  },
  {
    id: 'jpRetroFilm',
    enabled: true,
    previewSrcs: ['/preview/final_jp.jpg'],
  },
];

const AI_STYLE_PREVIEW_CACHE = 'ai-style-previews-v9';
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
  if (styleId === 'textOil') return true;
  return AI_DRAW_STYLES.find((s) => s.id === styleId)?.enabled !== false;
}

export function stylePromptFor(styleId: AiDrawStyleId): string {
  switch (styleId) {
    case 'textOil':
      // 프롬프트 없음 — 백엔드 기존 오일 텍스트 프롬프트만 사용
      return '';
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
  if (s === 'textOil' || s === 'text_oil' || s === 'text-oil') return 'textOil';
  if (s === 'oilPastel' || s === 'oil_pastel' || s === 'oil-pastel') return 'oilPastel';
  if (s === 'jpRetroFilm' || s === 'jpRetro' || s === 'retroFilm') return 'jpRetroFilm';
  // cartoonChar / kidSketch / storybook → 웹툰주인공
  return 'webtoonHero';
}

export function isPhotoAiDrawStyle(styleId: AiDrawStyleId): styleId is AiPhotoDrawStyleId {
  return styleId === 'webtoonHero' || styleId === 'oilPastel' || styleId === 'jpRetroFilm';
}

/** GPT Image 2 reference: width×height 면적 */
export const GPT_IMAGE2_MIN_AREA = 655_360;
export const GPT_IMAGE2_MAX_AREA = 8_294_400;
/** 긴 변 : 짧은 변 최대 비율 */
export const GPT_IMAGE2_MAX_ASPECT = 3;
/** 한 변 최대 (미만) — 규격은 3840 미만, 16 배수로 3824 */
export const GPT_IMAGE2_MAX_EDGE = 3824;

function snapMultipleOf16(n: number): number {
  return Math.max(16, Math.round(n / 16) * 16);
}

/**
 * 원본 픽셀을 GPT Image 2 규격에 맞게 크롭·스케일.
 * - 면적 655,360 ~ 8,294,400
 * - 비율 최대 3:1 (초과 시 중앙 크롭)
 * - 가로·세로 모두 16의 배수
 * - 한 변 ≤ 3824
 */
export function fitGptImage2Size(
  srcW: number,
  srcH: number,
): {
  outW: number;
  outH: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
} {
  let sx = 0;
  let sy = 0;
  let sw = Math.max(1, Math.round(srcW));
  let sh = Math.max(1, Math.round(srcH));

  // 1) 비율 3:1 초과 → 중앙 크롭
  if (sw / sh > GPT_IMAGE2_MAX_ASPECT) {
    const nextW = Math.max(1, Math.round(sh * GPT_IMAGE2_MAX_ASPECT));
    sx = Math.floor((sw - nextW) / 2);
    sw = nextW;
  } else if (sh / sw > GPT_IMAGE2_MAX_ASPECT) {
    const nextH = Math.max(1, Math.round(sw * GPT_IMAGE2_MAX_ASPECT));
    sy = Math.floor((sh - nextH) / 2);
    sh = nextH;
  }

  // 2) 면적·최대 변 맞추기 (스케일만, 아직 16 배수 X)
  let outW = sw;
  let outH = sh;
  const long = Math.max(outW, outH);
  if (long > GPT_IMAGE2_MAX_EDGE) {
    const scale = GPT_IMAGE2_MAX_EDGE / long;
    outW = Math.max(1, Math.floor(outW * scale));
    outH = Math.max(1, Math.floor(outH * scale));
  }
  let area = outW * outH;
  if (area > GPT_IMAGE2_MAX_AREA) {
    const scale = Math.sqrt(GPT_IMAGE2_MAX_AREA / area);
    outW = Math.max(1, Math.floor(outW * scale));
    outH = Math.max(1, Math.floor(outH * scale));
  } else if (area < GPT_IMAGE2_MIN_AREA) {
    const scale = Math.sqrt(GPT_IMAGE2_MIN_AREA / area);
    outW = Math.max(1, Math.ceil(outW * scale));
    outH = Math.max(1, Math.ceil(outH * scale));
  }

  // 3) 16 배수로 스냅 후 규격 재검증 (최대 몇 번)
  for (let i = 0; i < 8; i++) {
    outW = snapMultipleOf16(outW);
    outH = snapMultipleOf16(outH);

    if (outW > GPT_IMAGE2_MAX_EDGE) outW = GPT_IMAGE2_MAX_EDGE;
    if (outH > GPT_IMAGE2_MAX_EDGE) outH = GPT_IMAGE2_MAX_EDGE;
    outW = snapMultipleOf16(Math.min(outW, GPT_IMAGE2_MAX_EDGE));
    outH = snapMultipleOf16(Math.min(outH, GPT_IMAGE2_MAX_EDGE));

    if (outW / outH > GPT_IMAGE2_MAX_ASPECT) {
      outW = snapMultipleOf16(outH * GPT_IMAGE2_MAX_ASPECT);
    } else if (outH / outW > GPT_IMAGE2_MAX_ASPECT) {
      outH = snapMultipleOf16(outW * GPT_IMAGE2_MAX_ASPECT);
    }

    area = outW * outH;
    if (area > GPT_IMAGE2_MAX_AREA) {
      const scale = Math.sqrt(GPT_IMAGE2_MAX_AREA / area);
      outW = Math.max(16, Math.floor((outW * scale) / 16) * 16);
      outH = Math.max(16, Math.floor((outH * scale) / 16) * 16);
      continue;
    }
    if (area < GPT_IMAGE2_MIN_AREA) {
      const scale = Math.sqrt(GPT_IMAGE2_MIN_AREA / area);
      outW = Math.max(16, Math.ceil((outW * scale) / 16) * 16);
      outH = Math.max(16, Math.ceil((outH * scale) / 16) * 16);
      continue;
    }
    break;
  }

  // 최종 안전망
  outW = snapMultipleOf16(outW);
  outH = snapMultipleOf16(outH);
  if (outW / outH > GPT_IMAGE2_MAX_ASPECT) {
    outW = snapMultipleOf16(Math.min(outW, outH * GPT_IMAGE2_MAX_ASPECT));
  } else if (outH / outW > GPT_IMAGE2_MAX_ASPECT) {
    outH = snapMultipleOf16(Math.min(outH, outW * GPT_IMAGE2_MAX_ASPECT));
  }

  return { outW, outH, sx, sy, sw, sh };
}

/** AI 참조용 사진 → JPEG data URL (GPT Image 2 규격에 맞춤) */
export function fileToAiReferenceDataUrl(
  file: File,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 일부 기기에서 type 이 비어 있음 — 확장자로 보정
    const name = (file.name || '').toLowerCase();
    const looksImage =
      file.type.startsWith('image/') ||
      /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/.test(name);
    if (!looksImage && file.type !== '') {
      reject(new Error('image-only'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const src = String(reader.result ?? '');
      const img = new Image();
      img.onload = () => {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          reject(new Error('load-failed'));
          return;
        }
        const { outW, outH, sx, sy, sw, sh } = fitGptImage2Size(srcW, srcH);
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas-failed'));
          return;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('load-failed'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
