import { recordPurchaseRemote } from '../api/usageApi';
import { getAccessToken, isGoogleSignedIn } from '../hooks/useAuthSession';
import {
  getActiveSubProductId,
  getProPremiumUntilMs,
} from './diaryAccess';
import { SUB_MONTHLY_PRODUCT_ID } from './subscriptionProducts';

const LAST_SYNC_KEY = 'diary-sub-purchase-period-v1';

/**
 * 활성 구독의 스토어 만료(periodEnd)를 구매내역에 반영.
 * 월간·연간 구독 만료가 바뀌면 새 행이 생기고, 같은 주기는 서버에서 무시.
 * (연간 AI 월 충전 경계와 달리 실제 구독 만료를 씀)
 */
export async function syncSubscriptionPurchaseHistory(): Promise<void> {
  if (!isGoogleSignedIn()) return;
  const token = getAccessToken();
  if (!token) return;

  const periodEnd = getProPremiumUntilMs();
  if (periodEnd == null || periodEnd <= Date.now()) return;

  const productId = getActiveSubProductId() ?? SUB_MONTHLY_PRODUCT_ID;
  const syncKey = `${productId}:${periodEnd}`;

  try {
    if (localStorage.getItem(LAST_SYNC_KEY) === syncKey) return;
  } catch {
    // ignore
  }

  try {
    await recordPurchaseRemote(token, {
      kind: 'subscription',
      productId,
      creditsGranted: 0,
      billingPeriodEnd: periodEnd,
    });
    try {
      localStorage.setItem(LAST_SYNC_KEY, syncKey);
    } catch {
      // ignore
    }
  } catch (err) {
    console.warn('[subscription] purchase history sync failed', err);
  }
}
