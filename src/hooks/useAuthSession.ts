import { useCallback, useEffect, useState } from 'react';
import {
  fetchMe,
  loginAsGuest,
  loginWithGoogleIdToken,
  logoutRemote,
  deleteAccountRemote,
} from '../api/authApi';

export type AuthProvider = 'google' | 'apple' | 'guest';

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
export const AUTH_CHANGE_EVENT = 'diary-auth-changed';

function notifyAuthChanged() {
  try {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    // ignore
  }
}

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.provider) return null;
    // guest는 email이 없을 수 있음
    if (parsed.provider !== 'guest' && !parsed.email) return null;
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
  notifyAuthChanged();
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

/** localStorage의 현재 세션 (React state보다 최신일 수 있음) */
export function getAuthSession(): AuthSession | null {
  return loadSession();
}

function sessionFromAuth(
  provider: AuthProvider,
  auth: Awaited<ReturnType<typeof loginAsGuest>>,
  prevSynced: string | null = null,
): AuthSession {
  return {
    provider,
    userId: auth.user.id,
    email: auth.user.email || (provider === 'guest' ? '' : 'unknown@gmail.com'),
    displayName: auth.user.name || auth.user.email || 'User',
    photoUrl: auth.user.photoUrl,
    lastSyncedAt: prevSynced,
  };
}

/**
 * Google: 일기 클라우드 동기화
 * Guest: 닉네임·기기 ID로 친구 방
 * Apple: 미연동
 */
export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(loadSession);

  useEffect(() => {
    const sync = () => setSession(loadSession());
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, sync);
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string) => {
    const current = loadSession();
    const currentToken = loadToken();
    // 게스트 세션이면 Authorization 으로 보내 같은 users.id 승격
    const guestToken =
      current?.provider === 'guest' && currentToken ? currentToken : null;
    const prevSynced = current?.lastSyncedAt ?? null;
    const auth = await loginWithGoogleIdToken(idToken, guestToken);
    const next = sessionFromAuth('google', auth, prevSynced);
    saveToken(auth.accessToken);
    saveSession(next);
    setSession(next);
    return next;
  }, []);

  /** 닉네임+프사 있는 기기의 친구 방용 게스트 세션 확보 */
  const ensureGuestSession = useCallback(async (clientId: string, nickname: string) => {
    const nick = nickname.trim();
    if (!clientId.trim() || !nick) {
      throw new Error('닉네임이 필요해요');
    }
    const current = loadSession();
    // Google로 클라우드 동기화 중인 세션은 유지 (방은 Google 계정으로도 가능)
    if (current?.provider === 'google' && loadToken()) {
      return current;
    }
    // 이미 게스트 JWT가 있으면 매번 /auth/guest 호출하지 않음
    if (current?.provider === 'guest' && loadToken()) {
      return current;
    }
    const auth = await loginAsGuest(clientId.trim(), nick);
    const next = sessionFromAuth('guest', auth, current?.lastSyncedAt ?? null);
    saveToken(auth.accessToken);
    saveSession(next);
    setSession(next);
    return next;
  }, []);

  const signIn = useCallback(async (provider: AuthProvider) => {
    if (provider === 'apple') {
      throw new Error('Apple 로그인은 아직 준비 중이에요');
    }
    if (provider === 'guest') {
      throw new Error('게스트는 ensureGuestSession을 사용하세요');
    }
    throw new Error('Google 로그인은 계정 화면의 Google 버튼을 눌러 주세요');
  }, []);

  const signOut = useCallback(() => {
    const token = loadToken();
    void logoutRemote(token);
    saveToken(null);
    saveSession(null);
    setSession(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const token = loadToken();
    if (!token) throw new Error('로그인이 필요합니다');
    await deleteAccountRemote(token);
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
      const provider: AuthProvider =
        me.provider === 'guest' ? 'guest' : me.provider === 'apple' ? 'apple' : 'google';
      const next: AuthSession = {
        provider,
        userId: me.id,
        email: me.email || (provider === 'guest' ? '' : 'unknown@gmail.com'),
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

  return {
    session,
    signIn,
    signInWithGoogleIdToken,
    ensureGuestSession,
    signOut,
    deleteAccount,
    markSynced,
    refreshMe,
    getAccessToken,
  };
}
