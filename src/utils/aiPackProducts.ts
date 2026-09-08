/** Play / RevenueCat 소모성 — 대시보드에 동일 ID로 등록 필요 */
export type AiPackProductId = 'pageby_ai_draw_10' | 'pageby_ai_draw_20';

export const AI_PACK_PRODUCTS: {
  id: AiPackProductId;
  credits: number;
}[] = [
  { id: 'pageby_ai_draw_10', credits: 10 },
  { id: 'pageby_ai_draw_20', credits: 20 },
];

export function aiPackCreditsForProduct(productId: string | null | undefined): number {
  const id = productId?.trim() ?? '';
  const hit = AI_PACK_PRODUCTS.find(
    (p) => p.id === id || id.startsWith(`${p.id}:`),
  );
  return hit?.credits ?? 0;
}

export function isAiPackProduct(productId: string | null | undefined): boolean {
  return aiPackCreditsForProduct(productId) > 0;
}
