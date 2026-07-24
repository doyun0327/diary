import { useCallback, useState } from 'react';

const CLIENT_ID_KEY = 'picture-diary-client-id';
const NICKNAME_KEY = 'picture-diary-nickname';

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

/** 친구 방용 닉네임 + 기기 ID */
export function useClientProfile() {
  const [clientId] = useState(loadClientId);
  const [nickname, setNicknameState] = useState(loadNickname);

  const setNickname = useCallback((next: string) => {
    const trimmed = next.trim().slice(0, 20);
    setNicknameState(trimmed);
    try {
      localStorage.setItem(NICKNAME_KEY, trimmed);
    } catch {
      // ignore
    }
  }, []);

  return { clientId, nickname, setNickname };
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
