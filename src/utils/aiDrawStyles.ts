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
