/** Flutter(iOS) 네이티브 Sign in with Apple 결과 */
export interface NativeAppleCredential {
  identityToken: string;
  authorizationCode: string | null;
  userIdentifier: string | null;
  email: string | null;
  givenName: string | null;
  familyName: string | null;
}

declare global {
  interface Window {
    __onDiaryAppleCredential?: (credential: Partial<NativeAppleCredential>) => void;
    __onDiaryAppleSignInError?: (reason: string) => void;
  }
}

function diaryNative(): { postMessage: (message: string) => void } | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.DiaryNative;
}

/**
 * Flutter WebView(iOS): 네이티브 Apple 로그인 시트 → identityToken.
 * 실패 사유: 'cancelled' | 'unsupported' | 'no_identity_token' | 'failed' | 'timeout'
 */
export function requestNativeAppleSignIn(): Promise<NativeAppleCredential> {
  return new Promise((resolve, reject) => {
    const native = diaryNative();
    if (!native?.postMessage) {
      reject(new Error('native-only'));
      return;
    }
    // Apple 시트는 Face ID·암호 입력이 있어 Google 보다 길게 기다림
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, 120_000);

    const onOk = (credential: Partial<NativeAppleCredential>) => {
      cleanup();
      const identityToken = String(credential?.identityToken ?? '').trim();
      if (!identityToken) {
        reject(new Error('no_identity_token'));
        return;
      }
      resolve({
        identityToken,
        authorizationCode: credential.authorizationCode ?? null,
        userIdentifier: credential.userIdentifier ?? null,
        email: credential.email ?? null,
        givenName: credential.givenName ?? null,
        familyName: credential.familyName ?? null,
      });
    };
    const onErr = (reason: string) => {
      cleanup();
      reject(new Error(String(reason || 'cancelled')));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      if (window.__onDiaryAppleCredential === onOk) {
        window.__onDiaryAppleCredential = undefined;
      }
      if (window.__onDiaryAppleSignInError === onErr) {
        window.__onDiaryAppleSignInError = undefined;
      }
    };

    window.__onDiaryAppleCredential = onOk;
    window.__onDiaryAppleSignInError = onErr;
    native.postMessage(JSON.stringify({ type: 'appleSignIn' }));
  });
}
