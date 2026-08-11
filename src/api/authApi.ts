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

export async function loginWithGoogleIdToken(idToken: string): Promise<AuthResponseDto> {
  const res = await fetch(apiUrl('/api/auth/google'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
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
