import { useEffect } from 'react';
import { registerPushToken } from '../api/pushApi';
import { getAccessToken } from './useAuthSession';
import { isFlutterApp, postDiaryNative } from '../utils/nativeShare';

declare global {
  interface Window {
    __diaryPushToken?: string;
    __diaryOpenFromPush?: {
      type?: string;
      roomId?: string;
      postId?: string;
    };
  }
}

function syncPushTokenToServer(reason: string) {
  if (!getAccessToken()) {
    console.debug('[push] skip register (no access token)', reason);
    return;
  }
  const token = window.__diaryPushToken?.trim();
  if (!token) {
    console.debug('[push] skip register (no fcm token yet)', reason);
    // 앱이면 토큰 다시 요청
    if (isFlutterApp()) {
      postDiaryNative({ type: 'pushTokenSync' });
    }
    return;
  }
  void registerPushToken(token, 'android')
    .then(() => console.debug('[push] registered', reason))
    .catch((err) => {
      console.warn('[push] register failed', reason, err);
    });
}

/**
 * Flutter WebView FCM 토큰 → 서버 등록.
 * 로그인/계정 전환 직후에도 다시 붙여야 댓글 알림이 해당 userId로 감.
 */
export function usePushRegistration(enabled: boolean, accountKey?: string | null) {
  useEffect(() => {
    if (!enabled) return;

    const sync = () => syncPushTokenToServer(accountKey ? `account:${accountKey}` : 'tick');
    sync();
    // 로그인 직후 토큰·세션 타이밍 여유
    const t1 = window.setTimeout(sync, 800);
    const t2 = window.setTimeout(sync, 3000);

    const onToken = () => syncPushTokenToServer('event');
    window.addEventListener('diary-push-token', onToken);
    const timer = window.setInterval(() => syncPushTokenToServer('interval'), 15_000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('diary-push-token', onToken);
      window.clearInterval(timer);
    };
  }, [enabled, accountKey]);
}

export function usePushOpenHandler(
  onOpen: (payload: { type?: string; roomId: string; postId?: string }) => void,
) {
  useEffect(() => {
    const open = (detail?: Window['__diaryOpenFromPush']) => {
      const roomId = detail?.roomId?.trim();
      if (!roomId) return;
      onOpen({ type: detail?.type, roomId, postId: detail?.postId?.trim() || undefined });
      window.__diaryOpenFromPush = undefined;
    };

    const onEvent = (event: Event) => {
      const custom = event as CustomEvent<Window['__diaryOpenFromPush']>;
      open(custom.detail ?? window.__diaryOpenFromPush);
    };

    if (window.__diaryOpenFromPush?.roomId) {
      open(window.__diaryOpenFromPush);
    }
    window.addEventListener('diary-push-open', onEvent);
    return () => window.removeEventListener('diary-push-open', onEvent);
  }, [onOpen]);
}
