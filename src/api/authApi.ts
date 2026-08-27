import { apiUrl } from './config';

export interface AuthUserDto {
  id: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  provider: string;
}

export interface AuthResponseDto {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUserDto;
}

export async function loginWithGoogleIdToken(
  idToken: string,
  guestAccessToken?: string | null,
): Promise<AuthResponseDto> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  // 게스트 JWT를 같이 보내면 서버가 같은 users.id 로 Google 승격
  if (guestAccessToken) {
    headers.Authorization = `Bearer ${guestAccessToken}`;
  }

  const res = await fetch(apiUrl('/api/auth/google'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    let message = `로그인 실패 (HTTP ${res.status})`;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) message = err.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as AuthResponseDto;
}

/** 닉네임·기기 ID로 친구 방용 게스트 JWT */
export async function loginAsGuest(
  clientId: string,
  nickname: string,
): Promise<AuthResponseDto> {
  const res = await fetch(apiUrl('/api/auth/guest'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ clientId, nickname }),
  });

  if (!res.ok) {
    let message = `게스트 로그인 실패 (HTTP ${res.status})`;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) message = err.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as AuthResponseDto;
}

export async function fetchMe(accessToken: string): Promise<AuthUserDto> {
  const res = await fetch(apiUrl('/api/me'), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`세션 확인 실패 (HTTP ${res.status})`);
  }
  return (await res.json()) as AuthUserDto;
}

export async function logoutRemote(accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // ignore network errors on logout
  }
}

/** 클라우드 계정 탈퇴 (소프트 탈퇴 — GRACE 유예) */
export async function deleteAccountRemote(accessToken: string): Promise<void> {
  const res = await fetch(apiUrl('/api/me'), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok && res.status !== 204) {
    let message = `회원 탈퇴 실패 (HTTP ${res.status})`;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) message = err.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
}
