const GIS_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
          }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number>,
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let gisLoading: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (gisLoading) return gisLoading;

  gisLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google 로그인 스크립트 로드 실패')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 로그인 스크립트 로드 실패'));
    document.head.appendChild(script);
  });

  return gisLoading;
}

/**
 * Google Identity Services로 ID 토큰(JWT) 받기.
 * One Tap → 안 되면 임시 Google 버튼 모달.
 */
export async function requestGoogleIdToken(clientId: string): Promise<string> {
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID 가 없습니다');
  }
  await loadGisScript();
  if (!window.google?.accounts?.id) {
    throw new Error('Google Identity Services를 사용할 수 없습니다');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let host: HTMLDivElement | null = null;

    const finish = (err?: Error, token?: string) => {
      if (settled) return;
      settled = true;
      try {
        window.google?.accounts.id.cancel();
      } catch {
        // ignore
      }
      if (host?.parentNode) host.parentNode.removeChild(host);
      if (err) reject(err);
      else if (token) resolve(token);
      else reject(new Error('Google 로그인에 실패했습니다'));
    };

    window.google!.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        if (response.credential) finish(undefined, response.credential);
        else finish(new Error('Google 인증 정보를 받지 못했습니다'));
      },
    });

    const showButtonFallback = () => {
      host = document.createElement('div');
      host.setAttribute('role', 'dialog');
      host.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
      const box = document.createElement('div');
      box.style.cssText =
        'background:#fff;border-radius:16px;padding:20px 22px;max-width:320px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.2)';
      box.innerHTML =
        '<p style="margin:0 0 14px;font:600 15px/1.4 system-ui,sans-serif;color:#222">Google로 계속하기</p>';
      const btnHost = document.createElement('div');
      box.appendChild(btnHost);
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '닫기';
      cancel.style.cssText =
        'margin-top:14px;width:100%;border:0;background:#f3f3f3;border-radius:10px;padding:10px;font:14px system-ui;cursor:pointer';
      cancel.onclick = () => finish(new Error('로그인을 취소했습니다'));
      box.appendChild(cancel);
      host.appendChild(box);
      host.addEventListener('click', (e) => {
        if (e.target === host) finish(new Error('로그인을 취소했습니다'));
      });
      document.body.appendChild(host);
      window.google!.accounts.id.renderButton(btnHost, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 280,
      });
    };

    window.google!.accounts.id.prompt((notification) => {
      if (
        notification.isNotDisplayed() ||
        notification.isSkippedMoment() ||
        notification.isDismissedMoment()
      ) {
        showButtonFallback();
      }
    });
  });
}
