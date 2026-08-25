import {
  applySubscriptionStatus,
  getDiaryAccessState,
  SUBSCRIPTION_CHANGE_EVENT,
} from './diaryAccess';
import { isFlutterApp, postDiaryNative } from './nativeShare';

export type SubscriptionStatusPayload = {
  active: boolean;
  expiresAt: number | null;
  productId?: string | null;
};

function applyPayload(payload: SubscriptionStatusPayload) {
  applySubscriptionStatus(
    Boolean(payload.active),
    payload.expiresAt ?? null,
    payload.productId,
  );
}

export function identifySubscriptionUser(userId: string) {
  if (!userId.trim() || !isFlutterApp()) return;
  postDiaryNative({ type: 'subscriptionIdentify', userId: userId.trim() });
}

export function syncSubscriptionFromNative() {
  if (!isFlutterApp()) return;
  postDiaryNative({ type: 'subscriptionSync' });
}

/** AI 등에서 Pro 판정 전 네이티브 구독 상태를 한 번 더 맞춤 */
export function refreshSubscriptionStatus(timeoutMs = 1800): Promise<boolean> {
  if (!isFlutterApp()) {
    return Promise.resolve(getDiaryAccessState().isPremiumActive);
  }
  if (getDiaryAccessState().isPremiumActive) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('diary-subscription-status', onStatus);
      window.removeEventListener(SUBSCRIPTION_CHANGE_EVENT, onStatus);
      resolve(getDiaryAccessState().isPremiumActive);
    };
    const onStatus = () => {
      if (getDiaryAccessState().isPremiumActive) finish();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    window.addEventListener('diary-subscription-status', onStatus);
    window.addEventListener(SUBSCRIPTION_CHANGE_EVENT, onStatus);
    syncSubscriptionFromNative();
  });
}

export function requestSubscriptionPurchase() {
  if (!isFlutterApp()) return false;
  postDiaryNative({ type: 'subscriptionPurchase' });
  return true;
}

export function requestSubscriptionRestore() {
  if (!isFlutterApp()) return false;
  postDiaryNative({ type: 'subscriptionRestore' });
  return true;
}

export function installSubscriptionBridge() {
  window.__onDiarySubscriptionStatus = (payload) => {
    applyPayload(payload);
  };

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<SubscriptionStatusPayload>).detail;
    if (!detail) return;
    applyPayload(detail);
  };
  window.addEventListener('diary-subscription-status', onCustom);

  return () => {
    delete window.__onDiarySubscriptionStatus;
    window.removeEventListener('diary-subscription-status', onCustom);
  };
}
