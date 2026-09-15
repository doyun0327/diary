/** Play / App Store / RevenueCat 구독 상품 ID */
export const SUB_MONTHLY_PRODUCT_ID = 'pageby_monthly';
export const SUB_YEARLY_PRODUCT_ID = 'pageby_yearly';

export type SubProductId =
  | typeof SUB_MONTHLY_PRODUCT_ID
  | typeof SUB_YEARLY_PRODUCT_ID;

export const SUB_PRODUCTS: {
  id: SubProductId;
  /** 스토어 가격 없을 때 UI 폴백 (KRW) */
  fallbackPriceKrw: number;
}[] = [
  { id: SUB_MONTHLY_PRODUCT_ID, fallbackPriceKrw: 2900 },
  /** 월 2,900 × 12 = 34,800 → 연간 ₩29,800 */
  { id: SUB_YEARLY_PRODUCT_ID, fallbackPriceKrw: 29800 },
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

/** 월간×12 대비 연간 할인율 (반올림 %) */
export function yearlyDiscountPercent(): number {
  const monthly = SUB_PRODUCTS.find((p) => p.id === SUB_MONTHLY_PRODUCT_ID)
    ?.fallbackPriceKrw;
  const yearly = SUB_PRODUCTS.find((p) => p.id === SUB_YEARLY_PRODUCT_ID)
    ?.fallbackPriceKrw;
  if (!monthly || !yearly || monthly <= 0) return 0;
  const fullYear = monthly * 12;
  if (fullYear <= yearly) return 0;
  return Math.round(((fullYear - yearly) / fullYear) * 100);
}

export function formatSubFallbackPrice(krw: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale.startsWith('ko') ? 'ko-KR' : locale, {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(krw);
  } catch {
    return `₩${krw.toLocaleString('ko-KR')}`;
  }
}
