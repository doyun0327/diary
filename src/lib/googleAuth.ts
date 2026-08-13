import { isFlutterApp } from '../utils/nativeShare';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GIS_LOAD_TIMEOUT_MS = 12_000;
const GIS_MAX_ATTEMPTS = 3;

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
            context?: string;
            itp_support?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
          cancel: () => void;
        };
      };
    };
    /** HMR/중복 mount에도 initialize 1회만 유지 */
    __pagebyGoogleIdClient?: string;
    __pagebyGoogleIdTokenHandler?: ((idToken: string) => void) | null;
  }
}

let gisLoading: Promise<void> | null = null;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function injectGisScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;

    const timer = window.setTimeout(() => {
      cleanup();
      script.remove();
      reject(new Error('timeout'));
    }, GIS_LOAD_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };

    script.onload = () => {
      cleanup();
      if (window.google?.accounts?.id) resolve();
      else reject(new Error('loaded-without-api'));
    };
    script.onerror = () => {
      cleanup();
      script.remove();
      reject(new Error('network'));
    };
    document.head.appendChild(script);
  });
}

async function loadGisScriptOnce(): Promise<void> {
  if (window.google?.accounts?.id) return;

  document
    .querySelectorAll<HTMLScriptElement>(`script[src^="${GIS_SRC}"]`)
    .forEach((el) => el.remove());

  await injectGisScript(`${GIS_SRC}?v=${Date.now()}`);

  if (!window.google?.accounts?.id) {
    throw new Error('loaded-without-api');
  }
}

export async function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return;
  if (gisLoading) return gisLoading;

  gisLoading = (async () => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= GIS_MAX_ATTEMPTS; attempt += 1) {
      try {
        await loadGisScriptOnce();
        return;
      } catch (err) {
        lastError = err;
        if (attempt < GIS_MAX_ATTEMPTS) await wait(400 * attempt);
      }
    }
    const reason = lastError instanceof Error ? lastError.message : 'unknown';
    throw new Error(
      reason === 'timeout'
        ? 'Google 로그인 연결이 지연되고 있어요. 네트워크를 확인한 뒤 다시 시도해 주세요'
        : 'Google 로그인 버튼을 불러오지 못했어요. 광고차단을 끄거나 네트워크를 바꿔 주세요',
    );
  })();

  try {
    await gisLoading;
  } catch (err) {
    gisLoading = null;
    throw err;
  }
}

function ensureGoogleIdInitialized(clientId: string) {
  if (!window.google?.accounts?.id) {
    throw new Error('Google Identity Services를 사용할 수 없습니다');
  }

  if (window.__pagebyGoogleIdClient === clientId) return;

  window.__pagebyGoogleIdClient = clientId;

  window.google.accounts.id.initialize({
    client_id: clientId,
    auto_select: false,
    cancel_on_tap_outside: true,
    /** One Tap / FedCM 프롬프트 사용 안 함 — 인라인 버튼만 */
    use_fedcm_for_prompt: false,
    context: 'signin',
    itp_support: true,
    callback: (response) => {
      if (response.credential) {
        window.__pagebyGoogleIdTokenHandler?.(response.credential);
      }
    },
  });
}

/**
 * 계정 시트에 Google 공식 버튼을 인라인으로 붙인다.
 * One Tap / 커스텀 오버레이 / prompt() 는 호출하지 않는다.
 */
export async function mountGoogleSignInButton(
  container: HTMLElement,
  clientId: string,
  onIdToken: (idToken: string) => void,
  signal?: AbortSignal,
): Promise<() => void> {
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID 가 없습니다');
  }
  if (signal?.aborted) {
    return () => {};
  }

  await loadGisScript();
  if (signal?.aborted) {
    return () => {};
  }

  ensureGoogleIdInitialized(clientId);

  const handler = (token: string) => onIdToken(token);
  window.__pagebyGoogleIdTokenHandler = handler;

  container.replaceChildren();
  const fromLayout =
    container.getBoundingClientRect().width ||
    container.parentElement?.getBoundingClientRect().width ||
    0;
  const width = Math.max(240, Math.min(400, Math.floor(fromLayout || 320)));

  window.google!.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width,
    logo_alignment: 'left',
  });

  return () => {
    if (window.__pagebyGoogleIdTokenHandler === handler) {
      window.__pagebyGoogleIdTokenHandler = null;
    }
    container.replaceChildren();
  };
}

function diaryNative(): { postMessage: (message: string) => void } | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.DiaryNative;
}

/** Flutter WebView: 네이티브 Google 로그인 후 idToken */
export function requestNativeGoogleSignIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isFlutterApp()) {
      reject(new Error('native-only'));
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, 120_000);

    const onOk = (event: Event) => {
      const token = String((event as CustomEvent<string>).detail ?? '').trim();
      cleanup();
      if (token) resolve(token);
      else reject(new Error('empty'));
    };
    const onErr = (event: Event) => {
      const reason = String((event as CustomEvent<string>).detail ?? 'cancelled');
      cleanup();
      reject(new Error(reason));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('diary-google-id-token', onOk);
      window.removeEventListener('diary-google-sign-in-error', onErr);
    };

    window.addEventListener('diary-google-id-token', onOk);
    window.addEventListener('diary-google-sign-in-error', onErr);
    diaryNative()?.postMessage(JSON.stringify({ type: 'googleSignIn' }));
  });
}

export function nativeGoogleSignOut() {
  if (!isFlutterApp()) return;
  try {
    diaryNative()?.postMessage(JSON.stringify({ type: 'googleSignOut' }));
  } catch {
    // ignore
  }
}
