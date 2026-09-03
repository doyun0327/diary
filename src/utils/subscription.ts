import {
  applySubscriptionStatus,
  getDiaryAccessState,
  SUBSCRIPTION_CHANGE_EVENT,
} from './diaryAccess';
import { isGoogleSignedIn } from '../hooks/useAuthSession';
import { isFlutterApp, postDiaryNative } from './nativeShare';

export type SubscriptionStatusPayload = {
  active: boolean;
  expiresAt: number | null;
  productId?: string | null;
};

export const SUBSCRIPTION_PURCHASE_COMPLETE_EVENT =
  'diary-subscription-purchase-complete';

/** 게스트는 Pro 결제 전 구글 로그인 필요 */
export const REQUIRE_GOOGLE_FOR_PRO_EVENT = 'diary-require-google-for-pro';

const PURCHASE_SYNC_DELAYS_MS = [0, 400, 1200, 3000] as const;

function applyPayload(payload: SubscriptionStatusPayload) {
  applySubscriptionStatus(
    Boolean(payload.active),
    payload.expiresAt ?? null,
    payload.productId,
  );
}

function emitPurchaseComplete(payload: SubscriptionStatusPayload) {
  applyPayload(payload);
  window.dispatchEvent(
    new CustomEvent(SUBSCRIPTION_PURCHASE_COMPLETE_EVENT, { detail: payload }),
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

/** 결제 직후 네이티브 동기화를 여러 번 요청 (엔타이틀먼트 반영 지연 대비) */
export function scheduleSubscriptionSyncAfterPurchase() {
  if (!isFlutterApp()) return;
  for (const ms of PURCHASE_SYNC_DELAYS_MS) {
    window.setTimeout(() => syncSubscriptionFromNative(), ms);
  }
}

/** Pro 활성화까지 대기 (결제 완료 콜백·sync 응답) */
export function waitForPremiumActivation(timeoutMs = 120_000): Promise<boolean> {
  if (getDiaryAccessState().isPremiumActive) {
    return Promise.resolve(true);
  }
  if (!isFlutterApp()) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener(SUBSCRIPTION_CHANGE_EVENT, onChange);
      window.removeEventListener(
        SUBSCRIPTION_PURCHASE_COMPLETE_EVENT,
        onPurchaseComplete,
      );
      window.removeEventListener('diary-subscription-status', onStatusEvent);
      resolve(getDiaryAccessState().isPremiumActive);
    };
    const onChange = () => {
      if (getDiaryAccessState().isPremiumActive) finish();
    };
    const onPurchaseComplete = () => onChange();
    const onStatusEvent = () => onChange();
    window.addEventListener(SUBSCRIPTION_CHANGE_EVENT, onChange);
    window.addEventListener(
      SUBSCRIPTION_PURCHASE_COMPLETE_EVENT,
      onPurchaseComplete,
    );
    window.addEventListener('diary-subscription-status', onStatusEvent);
    const timer = window.setTimeout(finish, timeoutMs);
  });
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
  if (!isGoogleSignedIn()) {
    window.dispatchEvent(new Event(REQUIRE_GOOGLE_FOR_PRO_EVENT));
    return false;
  }
  if (!isFlutterApp()) return false;
  postDiaryNative({ type: 'subscriptionPurchase' });
  return true;
}

/** 구독 결제 시작 + Pro 활성화 대기 (이미 가입됨 → 복원 포함) */
export async function requestSubscriptionPurchaseAndSync(
  timeoutMs = 20_000,
): Promise<boolean> {
  if (!requestSubscriptionPurchase()) return false;
  scheduleSubscriptionSyncAfterPurchase();
  return waitForPremiumActivation(timeoutMs);
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

  window.__onDiarySubscriptionPurchaseComplete = (payload) => {
    emitPurchaseComplete(payload);
    syncSubscriptionFromNative();
  };

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<SubscriptionStatusPayload>).detail;
    if (!detail) return;
    applyPayload(detail);
  };
  window.addEventListener('diary-subscription-status', onCustom);

  return () => {
    delete window.__onDiarySubscriptionStatus;
    delete window.__onDiarySubscriptionPurchaseComplete;
    window.removeEventListener('diary-subscription-status', onCustom);
  };
}
