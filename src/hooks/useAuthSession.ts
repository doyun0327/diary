import { useCallback, useState } from 'react';
import { fetchMe, loginWithGoogleIdToken, logoutRemote } from '../api/authApi';
import { requestGoogleIdToken } from '../lib/googleAuth';

export type AuthProvider = 'google' | 'apple';

export interface AuthSession {
  provider: AuthProvider;
  email: string;
  displayName: string;
  photoUrl: string | null;
  lastSyncedAt: string | null;
  /** 서버 사용자 id */
  userId?: string;
}

const SESSION_KEY = 'picture-diary-auth-session';
const TOKEN_KEY = 'picture-diary-access-token';

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
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
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  return loadToken();
}

/**
 * Google: GIS idToken → POST /api/auth/google → JWT 저장
 * Apple: 아직 미연동
 */
export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(loadSession);

  const signIn = useCallback(async (provider: AuthProvider) => {
    if (provider === 'apple') {
      throw new Error('Apple 로그인은 아직 준비 중이에요');
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new Error('VITE_GOOGLE_CLIENT_ID 설정이 없어요');
    }

    const idToken = await requestGoogleIdToken(clientId);
    const auth = await loginWithGoogleIdToken(idToken);

    const next: AuthSession = {
      provider: 'google',
      userId: auth.user.id,
      email: auth.user.email || 'unknown@gmail.com',
      displayName: auth.user.name || auth.user.email || 'User',
      photoUrl: auth.user.photoUrl,
      lastSyncedAt: null,
    };

    saveToken(auth.accessToken);
    saveSession(next);
    setSession(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    const token = loadToken();
    void logoutRemote(token);
    saveToken(null);
    saveSession(null);
    setSession(null);
  }, []);

  const markSynced = useCallback((serverTime?: string | null) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        lastSyncedAt: serverTime || new Date().toISOString(),
      };
      saveSession(next);
      return next;
    });
  }, []);

  const refreshMe = useCallback(async () => {
    const token = loadToken();
    if (!token) return null;
    try {
      const me = await fetchMe(token);
      const next: AuthSession = {
        provider: 'google',
        userId: me.id,
        email: me.email || 'unknown@gmail.com',
        displayName: me.name || me.email || 'User',
        photoUrl: me.photoUrl,
        lastSyncedAt: loadSession()?.lastSyncedAt ?? null,
      };
      saveSession(next);
      setSession(next);
      return next;
    } catch {
      saveToken(null);
      saveSession(null);
      setSession(null);
      return null;
    }
  }, []);

  return { session, signIn, signOut, markSynced, refreshMe, getAccessToken };
}
