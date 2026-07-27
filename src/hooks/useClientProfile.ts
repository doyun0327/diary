import { useCallback, useState } from 'react';

const CLIENT_ID_KEY = 'picture-diary-client-id';
const NICKNAME_KEY = 'picture-diary-nickname';
const AVATAR_KEY = 'picture-diary-avatar';

function loadClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
  } catch {
    // ignore
  }
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(CLIENT_ID_KEY, id);
  } catch {
    // ignore
  }
  return id;
}

function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function loadAvatarUrl(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

/** 친구 방용 닉네임 · 프로필 사진 · 기기 ID */
export function useClientProfile() {
  const [clientId] = useState(loadClientId);
  const [nickname, setNicknameState] = useState(loadNickname);
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(loadAvatarUrl);

  const setNickname = useCallback((next: string) => {
    const trimmed = next.trim().slice(0, 20);
    setNicknameState(trimmed);
    try {
      localStorage.setItem(NICKNAME_KEY, trimmed);
    } catch {
      // ignore
    }
  }, []);

  const setAvatarUrl = useCallback((next: string | null) => {
    setAvatarUrlState(next);
    try {
      if (next) localStorage.setItem(AVATAR_KEY, next);
      else localStorage.removeItem(AVATAR_KEY);
    } catch {
      // quota 등 — 상태는 유지하되 저장 실패는 조용히
    }
  }, []);

  return { clientId, nickname, setNickname, avatarUrl, setAvatarUrl };
}

export function getClientHeaders(): HeadersInit {
  const clientId = loadClientId();
  // fetch 헤더는 ISO-8859-1만 허용 → 한글 닉네임은 URI 인코딩
  const nickname = encodeURIComponent(loadNickname() || '익명');
  return {
    'X-Client-Id': clientId,
    'X-Nickname': nickname,
  };
}
