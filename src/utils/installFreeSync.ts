import {
  consumeInstallFreeRemote,
  refundInstallFreeRemote,
  syncInstallFreeRemote,
} from '../api/usageApi';
import { getAccessToken } from '../hooks/useAuthSession';
import {
  applyInstallFreeRemainingFromServer,
  consumeInstallFreeAiDraw,
  getInstallFreeAiDrawsRemaining,
  refundInstallFreeAiDraw,
} from './diaryAccess';
import { getNativeInstallDeviceKey, isFlutterApp } from './nativeShare';

/** Flutter + 기기 키 + JWT 있을 때 서버 잔여로 로컬 맞춤 */
export async function syncInstallFreeQuota(): Promise<number | null> {
  if (!isFlutterApp()) return null;
  const deviceKey = getNativeInstallDeviceKey();
  if (!deviceKey) return null;
  const token = getAccessToken();
  if (!token) return null;
  try {
    const view = await syncInstallFreeRemote(
      token,
      deviceKey,
      getInstallFreeAiDrawsRemaining(),
    );
    applyInstallFreeRemainingFromServer(view.remaining);
    return view.remaining;
  } catch (err) {
    console.warn('[install-free] sync failed', err);
    return null;
  }
}

/** 성공 시 true. 서버 가능하면 서버 차감, 아니면 로컬만. */
export async function tryConsumeInstallFreeQuota(): Promise<boolean> {
  if (!isFlutterApp()) {
    return consumeInstallFreeAiDraw();
  }
  const deviceKey = getNativeInstallDeviceKey();
  const token = getAccessToken();
  if (deviceKey && token) {
    try {
      const view = await consumeInstallFreeRemote(
        token,
        deviceKey,
        getInstallFreeAiDrawsRemaining(),
      );
      applyInstallFreeRemainingFromServer(view.remaining);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('409') || message.includes('없어요')) {
        applyInstallFreeRemainingFromServer(0);
        return false;
      }
      // 네트워크 등: 로컬 폴백 (이후 동기화가 서버와 min 맞춤)
      return consumeInstallFreeAiDraw();
    }
  }
  return consumeInstallFreeAiDraw();
}

export async function tryRefundInstallFreeQuota(): Promise<boolean> {
  if (!isFlutterApp()) {
    return refundInstallFreeAiDraw();
  }
  const deviceKey = getNativeInstallDeviceKey();
  const token = getAccessToken();
  if (deviceKey && token) {
    try {
      const view = await refundInstallFreeRemote(
        token,
        deviceKey,
        getInstallFreeAiDrawsRemaining(),
      );
      applyInstallFreeRemainingFromServer(view.remaining);
      return true;
    } catch {
      return refundInstallFreeAiDraw();
    }
  }
  return refundInstallFreeAiDraw();
}
