/** Google 로그아웃 직후 — PageBy 목록은 재로그인 유도, 자동 게스트 세션은 막음 */

const KEY = 'picture-diary-rooms-need-google';

export function markRoomsNeedGoogleLogin(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // ignore
  }
}

export function clearRoomsNeedGoogleLogin(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function roomsNeedGoogleLogin(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
