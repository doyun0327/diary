/**
 * AI 그림 스타일 — 프론트는 style id만 넘김.
 * 모델·사이즈·프롬프트는 백엔드 설정/로직에서 처리.
 */

export type AiDrawStyleId = 'storybook' | 'oilPastel';

export const AI_DRAW_STYLES: { id: AiDrawStyleId }[] = [
  { id: 'storybook' },
  { id: 'oilPastel' },
];
