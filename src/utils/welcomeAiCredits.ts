import { type PurchaseRecordDto } from '../api/usageApi';
import { isAiPackProduct } from './aiPackProducts';
import {
  getAiPackCredits,
  syncWelcomeRemainingFromGrants,
} from './diaryAccess';

/** Google 로그인 환영 AI — 구매 내역 productId (신규 지급 중단, 과거 내역 표시용) */
export const WELCOME_AI_PRODUCT_ID = 'pageby_ai_welcome';
export const WELCOME_AI_CREDITS = 3;

export function isWelcomeAiPurchase(
  row:
    | string
    | (Pick<PurchaseRecordDto, 'productId' | 'kind'> &
        Partial<Pick<PurchaseRecordDto, 'creditsGranted'>>),
): boolean {
  if (typeof row === 'string') {
    const id = row.trim().toLowerCase();
    return (
      id === WELCOME_AI_PRODUCT_ID ||
      id === 'welcome' ||
      id.includes('welcome')
    );
  }
  const kind = String(row.kind ?? '').toLowerCase();
  if (kind === 'welcome' || kind === 'ai_welcome') return true;
  if (isWelcomeAiPurchase(row.productId)) return true;
  // 스토어 팩 ID가 아닌 3회 지급 → Welcome으로 간주
  return (
    !isAiPackProduct(row.productId) &&
    Number(row.creditsGranted) === WELCOME_AI_CREDITS &&
    (kind === 'ai_pack' || kind === 'ai-pack' || kind === '')
  );
}

/** 실제 스토어 구매 팩만 (Welcome 제외) */
export function isPaidAiPackPurchase(
  row: Pick<PurchaseRecordDto, 'productId' | 'kind'> &
    Partial<Pick<PurchaseRecordDto, 'creditsGranted'>>,
): boolean {
  if (isWelcomeAiPurchase(row)) return false;
  const kind = String(row.kind ?? '').toLowerCase();
  if (kind === 'subscription') return false;
  if (kind === 'ai_pack' || kind === 'ai-pack') return true;
  return isAiPackProduct(row.productId);
}

function applyWelcomeRemainingFromHistory(items: PurchaseRecordDto[]) {
  const welcomeGranted = items
    .filter(isWelcomeAiPurchase)
    .reduce((sum, row) => sum + Math.max(0, row.creditsGranted || 0), 0);
  const purchasedGranted = items
    .filter(isPaidAiPackPurchase)
    .reduce((sum, row) => sum + Math.max(0, row.creditsGranted || 0), 0);
  syncWelcomeRemainingFromGrants(
    welcomeGranted,
    purchasedGranted,
    getAiPackCredits(),
  );
}

/**
 * @deprecated Welcome 3회 신규 중단. 호출해도 서버에 청구하지 않음.
 */
export async function claimWelcomeAiCredits(): Promise<number> {
  return 0;
}

/** 냥티켓 구매내역·팩 잔량 표시용 Welcome 잔여 동기화 */
export function syncWelcomeFromPurchaseHistory(items: PurchaseRecordDto[]) {
  applyWelcomeRemainingFromHistory(items);
}
