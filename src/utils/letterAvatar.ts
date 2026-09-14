const NICKNAME_KEY = 'picture-diary-nickname';
const AVATAR_KEY = 'picture-diary-avatar';

/** 테마 변경 시 이니셜 아바타가 갱신됐을 때 */
export const AVATAR_CHANGED_EVENT = 'picture-diary-avatar-changed';

/** 업로드 사진은 JPEG data URL, 이니셜은 PNG data URL */
export function isLetterAvatarDataUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('data:image/png');
}

/** 이름 첫 글자로 원형 프로필 data URL 생성 */
export function letterAvatarDataUrl(letter: string, size = 320): string {
  const ch = (letter.trim() || '?').slice(0, 1).toUpperCase();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent-soft')
      .trim() || '#e8e4dc';
  const fg =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent-text')
      .trim() || '#3a342c';

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fg;
  ctx.font = `700 ${Math.round(size * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, size / 2, size / 2 + size * 0.02);

  return canvas.toDataURL('image/png');
}

/** 테마 CSS 변수 반영 후 저장된 이니셜 아바타를 다시 그림 */
export function refreshStoredLetterAvatar(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  let current: string | null = null;
  let nick = '';
  try {
    current = localStorage.getItem(AVATAR_KEY);
    nick = localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return null;
  }
  if (!isLetterAvatarDataUrl(current)) return null;
  const next = letterAvatarDataUrl(nick.trim() || '?');
  if (!next || next === current) return next || null;
  try {
    localStorage.setItem(AVATAR_KEY, next);
  } catch {
    // quota 등 — 이벤트만으로 UI 갱신 시도
  }
  window.dispatchEvent(
    new CustomEvent(AVATAR_CHANGED_EVENT, { detail: next }),
  );
  return next;
}
