import { apiUrl } from './config';
import { getAccessToken } from '../hooks/useAuthSession';

export async function registerPushToken(token: string, platform = 'android'): Promise<void> {
  const access = getAccessToken();
  if (!access || !token.trim()) return;
  const res = await fetch(apiUrl('/api/me/push-token'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({ token: token.trim(), platform }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`푸시 등록 실패 (HTTP ${res.status})`);
  }
}
