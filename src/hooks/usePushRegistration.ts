import { useEffect } from 'react';
import { registerPushToken } from '../api/pushApi';
import { getAccessToken } from './useAuthSession';

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

/** Flutter WebView가 주입한 FCM 토큰을 서버에 등록 */
export function usePushRegistration(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const sync = () => {
      if (!getAccessToken()) return;
      const token = window.__diaryPushToken?.trim();
      if (!token) return;
      void registerPushToken(token, 'android').catch((err) => {
        console.warn('[push] register failed', err);
      });
    };

    sync();
    const onToken = () => sync();
    window.addEventListener('diary-push-token', onToken);
    const timer = window.setInterval(sync, 15_000);
    return () => {
      window.removeEventListener('diary-push-token', onToken);
      window.clearInterval(timer);
    };
  }, [enabled]);
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
