import {
  claimWelcomeAiPackCredits,
  fetchPurchaseRecords,
  recordPurchaseRemote,
  type PurchaseRecordDto,
} from '../api/usageApi';
import { getAccessToken, isGoogleSignedIn } from '../hooks/useAuthSession';
import { isAiPackProduct } from './aiPackProducts';
import {
  applyAiPackCreditsFromServer,
  getAiPackCredits,
  setWelcomeAiCreditsRemaining,
  syncWelcomeRemainingFromGrants,
} from './diaryAccess';

/** Google 로그인 환영 AI — 구매 내역 productId */
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
 * Google 연동 계정에 무료 AI 3회 청구 (서버 계정당 1회).
 * 이미 받았으면 잔여만 동기화. 구매 내역에 Welcome 체험권으로 남김.
 */
export async function claimWelcomeAiCredits(): Promise<number> {
  if (!isGoogleSignedIn()) return 0;
  const token = getAccessToken();
  if (!token) return 0;

  try {
    const before = getAiPackCredits();
    const view = await claimWelcomeAiPackCredits(token);
    applyAiPackCreditsFromServer(view.credits);
    const gained = Math.max(0, view.credits - before);

    if (gained > 0) {
      const granted = Math.min(WELCOME_AI_CREDITS, gained);
      setWelcomeAiCreditsRemaining(granted);
      try {
        await recordPurchaseRemote(token, {
          kind: 'ai_pack',
          productId: WELCOME_AI_PRODUCT_ID,
          creditsGranted: WELCOME_AI_CREDITS,
        });
      } catch (err) {
        console.warn('[ai] welcome history save failed', err);
      }
    } else {
      try {
        const data = await fetchPurchaseRecords(token);
        applyWelcomeRemainingFromHistory(data.items ?? []);
      } catch (err) {
        console.warn('[ai] welcome history sync failed', err);
      }
    }

    return view.credits;
  } catch (err) {
    console.warn('[ai] welcome claim failed', err);
    return 0;
  }
}

/** 냥티켓 구매내역·팩 잔량 표시용 Welcome 잔여 동기화 */
export function syncWelcomeFromPurchaseHistory(items: PurchaseRecordDto[]) {
  applyWelcomeRemainingFromHistory(items);
}
