/**
 * AI 그림 스타일 — 프론트는 style id만 넘김.
 * 모델·사이즈·프롬프트는 백엔드 설정/로직에서 처리.
 * previewSrcs: 사용자용 샘플 (public/preview)
 */

export type AiDrawStyleId = 'storybook' | 'oilPastel';

export const AI_DRAW_STYLES: {
  id: AiDrawStyleId;
  previewSrcs: string[];
}[] = [
  {
    id: 'storybook',
    previewSrcs: [
      '/preview/storybook.jpg',
      '/preview/storybook2.jpg',
      '/preview/storybook3.jpg',
    ],
  },
  {
    id: 'oilPastel',
    previewSrcs: [
      '/preview/oilpastel.jpg',
      '/preview/oilpastel2.jpg',
      '/preview/oilpastel3.jpg',
    ],
  },
];

const AI_STYLE_PREVIEW_CACHE = 'ai-style-previews-v1';
const preloadedAiStyleSrcs = new Set<string>();

/** 앱 기동 시 영어동화책/오일파스텔 미리보기 이미지를 미리 받아 둔다 */
export function preloadAiStylePreviews() {
  const urls = AI_DRAW_STYLES.flatMap((style) => style.previewSrcs);
  for (const src of urls) {
    if (!src || preloadedAiStyleSrcs.has(src)) continue;
    preloadedAiStyleSrcs.add(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    void img.decode?.().catch(() => undefined);
  }

  // Cache Storage에도 넣어 재실행·스타일 펼침 시 네트워크 왕복 줄임
  if (typeof caches === 'undefined') return;
  void caches
    .open(AI_STYLE_PREVIEW_CACHE)
    .then(async (cache) => {
      await Promise.all(
        urls.map(async (url) => {
          try {
            const hit = await cache.match(url);
            if (hit) return;
            await cache.add(url);
          } catch {
            /* ignore offline / opaque failures */
          }
        }),
      );
    })
    .catch(() => undefined);
}
