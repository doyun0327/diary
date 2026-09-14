import { useCallback, useState } from 'react';
import { createId } from '../utils/id';
import {
  isProfileAgeGroup,
  isProfileGender,
  type ProfileAgeGroup,
  type ProfileGender,
} from '../utils/profileDemographics';

const CLIENT_ID_KEY = 'picture-diary-client-id';
const NICKNAME_KEY = 'picture-diary-nickname';
const AVATAR_KEY = 'picture-diary-avatar';
const GENDER_KEY = 'picture-diary-gender';
const AGE_GROUP_KEY = 'picture-diary-age-group';

export function readStoredClientId(): string {
  return loadClientId();
}

export function readStoredNickname(): string {
  return loadNickname();
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
  const [nickname, setNicknameState] = useState(loadNickname);
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(loadAvatarUrl);
  const [gender, setGenderState] = useState<ProfileGender | null>(loadGender);
  const [ageGroup, setAgeGroupState] = useState<ProfileAgeGroup | null>(
    loadAgeGroup,
  );

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
  const nickname = encodeURIComponent(loadNickname() || '익명');
  return {
    'X-Client-Id': clientId,
    'X-Nickname': nickname,
  };
}
