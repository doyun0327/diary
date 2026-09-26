import { recordPurchaseRemote } from '../api/usageApi';
import { getAccessToken, isGoogleSignedIn } from '../hooks/useAuthSession';
import {
  getActiveSubProductId,
  getProBillingPeriodEndMs,
} from './diaryAccess';
import { SUB_MONTHLY_PRODUCT_ID } from './subscriptionProducts';

const LAST_SYNC_KEY = 'diary-sub-purchase-period-v1';

/**
 * 활성 구독의 현재 결제 주기(periodEnd)를 구매내역에 반영.
 * 매달(또는 매년) periodEnd 가 바뀌면 새 행이 생기고, 같은 주기는 서버에서 무시.
 */
export async function syncSubscriptionPurchaseHistory(): Promise<void> {
  if (!isGoogleSignedIn()) return;
  const token = getAccessToken();
  if (!token) return;

  const periodEnd = getProBillingPeriodEndMs();
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
