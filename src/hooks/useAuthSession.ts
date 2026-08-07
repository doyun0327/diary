import { useCallback, useState } from 'react';

export type AuthProvider = 'google' | 'apple';

export interface AuthSession {
  provider: AuthProvider;
  /** 계정 식별용 (표시·동기화). 프론트 mock 단계 */
  email: string;
  /** 소셜 계정에서 가져온 표시 이름 */
  displayName: string;
  /** 소셜 프로필 사진 URL (없을 수 있음 — Apple은 자주 비어 있음) */
  photoUrl: string | null;
  /** ISO — 프론트에서 ‘마지막 동기화’ 표시용 */
  lastSyncedAt: string | null;
}

const STORAGE_KEY = 'picture-diary-auth-session';

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.provider || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 실제 OAuth 전까지 쓰는 가짜 프로필 (UI·플로우 검증용) */
function mockProfile(provider: AuthProvider): Omit<AuthSession, 'lastSyncedAt'> {
  if (provider === 'google') {
    return {
      provider: 'google',
      email: 'you@gmail.com',
      displayName: 'PageBy User',
      photoUrl: 'https://api.dicebear.com/9.x/thumbs/svg?seed=pageby-google',
    };
  }
  return {
    provider: 'apple',
    email: 'you@privaterelay.appleid.com',
    displayName: 'PageBy User',
    // Apple은 프로필 사진을 거의 주지 않음
    photoUrl: null,
  };
}

/**
 * 계정 로그인·동기화 상태 (프론트 mock).
 * 백엔드 OAuth 붙일 때 signIn 본문만 교체하면 됨.
 */
export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(loadSession);

  const signIn = useCallback(async (provider: AuthProvider) => {
    // 실제 연동 전: 짧은 딜레이로 로딩 UX만
    await new Promise((r) => setTimeout(r, 450));
    const next: AuthSession = {
      ...mockProfile(provider),
      lastSyncedAt: new Date().toISOString(),
    };
    saveSession(next);
    setSession(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  const markSynced = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, lastSyncedAt: new Date().toISOString() };
      saveSession(next);
      return next;
    });
  }, []);

  return { session, signIn, signOut, markSynced };
}
