import { useCallback, useEffect, useState } from 'react';
import { createId } from '../utils/id';
import { AVATAR_CHANGED_EVENT } from '../utils/letterAvatar';
import {
  isProfileAgeGroup,
  isProfileGender,
  type ProfileAgeGroup,
  type ProfileGender,
} from '../utils/profileDemographics';

const CLIENT_ID_KEY = 'picture-diary-client-id';
/** 레거시 전역 키 — 계정별 키로 이전 */
const NICKNAME_KEY = 'picture-diary-nickname';
const AVATAR_KEY = 'picture-diary-avatar';
const GENDER_KEY = 'picture-diary-gender';
const AGE_GROUP_KEY = 'picture-diary-age-group';
/** useAuthSession SESSION_KEY — 순환 import 없이 userId만 읽음 */
const AUTH_SESSION_KEY = 'picture-diary-auth-session';
const AUTH_CHANGE_EVENT = 'diary-auth-changed';

function readSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string };
    const id = parsed.userId?.trim();
    return id || null;
  } catch {
    return null;
  }
}

function nicknameStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${NICKNAME_KEY}:${id}` : NICKNAME_KEY;
}

export function readStoredClientId(): string {
  return loadClientId();
}

export function readStoredNickname(userId?: string | null): string {
  return loadNickname(userId ?? readSessionUserId());
}

export function readStoredGender(): ProfileGender | null {
  return loadGender();
}

export function readStoredAgeGroup(): ProfileAgeGroup | null {
  return loadAgeGroup();
}

function loadClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
  } catch {
    // ignore
  }
  const id = createId();
  try {
    localStorage.setItem(CLIENT_ID_KEY, id);
  } catch {
    // ignore
  }
  return id;
}

function loadNickname(userId?: string | null): string {
  const key = nicknameStorageKey(userId);
  try {
    const scoped = localStorage.getItem(key);
    if (scoped != null && scoped !== '') return scoped;
    // 계정 키가 비어 있으면 레거시 전역 닉을 한 번 이전
    if (key !== NICKNAME_KEY) {
      const legacy = localStorage.getItem(NICKNAME_KEY);
      if (legacy != null && legacy !== '') {
        localStorage.setItem(key, legacy);
        return legacy;
      }
    }
    return scoped ?? '';
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

function loadGender(): ProfileGender | null {
  try {
    const raw = localStorage.getItem(GENDER_KEY);
    return isProfileGender(raw) ? raw : null;
  } catch {
    return null;
  }
}

function loadAgeGroup(): ProfileAgeGroup | null {
  try {
    const raw = localStorage.getItem(AGE_GROUP_KEY);
    return isProfileAgeGroup(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** 친구 방용 닉네임 · 프로필 사진 · 성별 · 연령 · 기기 ID */
export function useClientProfile() {
  const [clientId] = useState(loadClientId);
  const [nickname, setNicknameState] = useState(() =>
    loadNickname(readSessionUserId()),
  );
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(loadAvatarUrl);
  const [gender, setGenderState] = useState<ProfileGender | null>(loadGender);
  const [ageGroup, setAgeGroupState] = useState<ProfileAgeGroup | null>(
    loadAgeGroup,
  );

  const setNickname = useCallback((next: string) => {
    const trimmed = next.trim().slice(0, 20);
    setNicknameState(trimmed);
    const key = nicknameStorageKey(readSessionUserId());
    try {
      localStorage.setItem(key, trimmed);
      // 레거시 키도 맞춰 두어 구코드 경로와 일치
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

  const setGender = useCallback((next: ProfileGender | null) => {
    setGenderState(next);
    try {
      if (next) localStorage.setItem(GENDER_KEY, next);
      else localStorage.removeItem(GENDER_KEY);
    } catch {
      // ignore
    }
  }, []);

  const setAgeGroup = useCallback((next: ProfileAgeGroup | null) => {
    setAgeGroupState(next);
    try {
      if (next) localStorage.setItem(AGE_GROUP_KEY, next);
      else localStorage.removeItem(AGE_GROUP_KEY);
    } catch {
      // ignore
    }
  }, []);

  // 계정 전환 시 해당 계정 닉네임으로 교체 (다른 사람 닉으로 공유되는 문제 방지)
  useEffect(() => {
    const syncNick = () => {
      setNicknameState(loadNickname(readSessionUserId()));
    };
    syncNick();
    window.addEventListener(AUTH_CHANGE_EVENT, syncNick);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, syncNick);
  }, []);

  useEffect(() => {
    const onAvatarChanged = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (typeof next === 'string' && next) {
        setAvatarUrlState(next);
      }
    };
    window.addEventListener(AVATAR_CHANGED_EVENT, onAvatarChanged);
    return () => {
      window.removeEventListener(AVATAR_CHANGED_EVENT, onAvatarChanged);
    };
  }, []);

  return {
    clientId,
    nickname,
    setNickname,
    avatarUrl,
    setAvatarUrl,
    gender,
    setGender,
    ageGroup,
    setAgeGroup,
  };
}

export function getClientHeaders(): HeadersInit {
  const clientId = loadClientId();
  // fetch 헤더는 ISO-8859-1만 허용 → 한글 닉네임은 URI 인코딩
  const nickname = encodeURIComponent(
    loadNickname(readSessionUserId()) || '익명',
  );
  return {
    'X-Client-Id': clientId,
    'X-Nickname': nickname,
  };
}
