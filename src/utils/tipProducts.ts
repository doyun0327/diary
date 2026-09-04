/** Play / App Store / RevenueCat 소모성 상품 ID와 표시용 메타 */
export type TipProductId =
  | 'pageby_churu_1'
  | 'pageby_churu_3'
  | 'pageby_churu_box';

export type TipProduct = {
  id: TipProductId;
  /** i18n key suffix under appInfo.churu.products */
  nameKey: 'one' | 'three' | 'box';
  /** 스토어 가격 미조회 시 임시 표시 (KR 기준) */
  fallbackPriceLabel: string;
  emoji: string;
};

export const TIP_PRODUCTS: TipProduct[] = [
  {
    id: 'pageby_churu_1',
    nameKey: 'one',
    fallbackPriceLabel: '₩1,100',
    emoji: '🐟',
  },
  {
    id: 'pageby_churu_3',
    nameKey: 'three',
    fallbackPriceLabel: '₩3,300',
    emoji: '🐟🐟🐟',
  },
  {
    id: 'pageby_churu_box',
    nameKey: 'box',
    fallbackPriceLabel: '₩11,000',
    emoji: '📦',
  },
];

export function isTipProductId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.includes('churu') || TIP_PRODUCTS.some((p) => p.id === id);
}
