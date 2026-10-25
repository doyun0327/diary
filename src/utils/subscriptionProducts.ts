/** Play / App Store / RevenueCat 구독 상품 ID */
export const SUB_MONTHLY_PRODUCT_ID = 'pageby_monthly';
export const SUB_YEARLY_PRODUCT_ID = 'pageby_yearly';

export type SubProductId =
  | typeof SUB_MONTHLY_PRODUCT_ID
  | typeof SUB_YEARLY_PRODUCT_ID;

/**
 * 가격은 코드에 두지 않음 — 스토어(App Store / Play)가 사용자 스토어 국가별로
 * 내려주는 가격만 표시한다. 못 받으면 가격 대신 "구매"만 보여줌.
 */
export const SUB_PRODUCTS: { id: SubProductId }[] = [
  { id: SUB_MONTHLY_PRODUCT_ID },
  { id: SUB_YEARLY_PRODUCT_ID },
];

export function isSubProductId(id: string | null | undefined): id is SubProductId {
  return id === SUB_MONTHLY_PRODUCT_ID || id === SUB_YEARLY_PRODUCT_ID;
}

/** 스토어/RC productId → 월간|연간 (없으면 null) */
export function matchSubProductId(
  productId: string | null | undefined,
): SubProductId | null {
  const id = productId?.trim() ?? '';
  if (!id) return null;
  if (
    id === SUB_YEARLY_PRODUCT_ID ||
    id.startsWith(`${SUB_YEARLY_PRODUCT_ID}:`) ||
    id.includes('yearly') ||
    id.includes('annual')
  ) {
    return SUB_YEARLY_PRODUCT_ID;
  }
  if (
    id === SUB_MONTHLY_PRODUCT_ID ||
    id.startsWith(`${SUB_MONTHLY_PRODUCT_ID}:`) ||
    id.includes('monthly')
  ) {
    return SUB_MONTHLY_PRODUCT_ID;
  }
  return null;
}

/**
 * 월간×12 대비 연간 할인율 (반올림 %). 스토어 숫자 가격(같은 통화) 기준.
 * 가격이 없거나 할인이 아니면 0 → 배지 숨김
 */
export function yearlyDiscountPercent(
  monthly: number | null | undefined,
  yearly: number | null | undefined,
): number {
  if (!monthly || !yearly || monthly <= 0 || yearly <= 0) return 0;
  const fullYear = monthly * 12;
  if (fullYear <= yearly) return 0;
  return Math.round(((fullYear - yearly) / fullYear) * 100);
}
