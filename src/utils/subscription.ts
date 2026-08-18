import { applySubscriptionStatus } from './diaryAccess';
import { isFlutterApp, postDiaryNative } from './nativeShare';

export type SubscriptionStatusPayload = {
  active: boolean;
  expiresAt: number | null;
  productId?: string;
};

declare global {
  interface Window {
    __onDiarySubscriptionStatus?: (payload: SubscriptionStatusPayload) => void;
  }
}

export function identifySubscriptionUser(userId: string) {
  if (!userId.trim() || !isFlutterApp()) return;
  postDiaryNative({ type: 'subscriptionIdentify', userId: userId.trim() });
}

export function syncSubscriptionFromNative() {
  if (!isFlutterApp()) return;
  postDiaryNative({ type: 'subscriptionSync' });
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
    applySubscriptionStatus(payload.active, payload.expiresAt ?? null);
  };

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<SubscriptionStatusPayload>).detail;
    if (!detail) return;
    applySubscriptionStatus(detail.active, detail.expiresAt ?? null);
  };
  window.addEventListener('diary-subscription-status', onCustom);

  return () => {
    delete window.__onDiarySubscriptionStatus;
    window.removeEventListener('diary-subscription-status', onCustom);
  };
}
