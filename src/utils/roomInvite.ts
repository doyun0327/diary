import { isFlutterApp } from './nativeShare';

const PENDING_INVITE_KEY = 'picture-diary-pending-room-invite';

/** Play 스토어 (미설치 시) */
export function getAppInstallUrl(inviteCode?: string): string {
  const base =
    (import.meta.env.VITE_APP_SHARE_URL as string | undefined)?.trim() ||
    'https://play.google.com/store/apps/details?id=com.yun.diary_app';
  if (!inviteCode) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}referrer=${encodeURIComponent(`invite_code=${inviteCode}`)}`;
}

/** 초대 링크 호스트 (앱·웹 공통) */
export function getInviteWebOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APP_WEB_ORIGIN as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    const o = window.location.origin;
    // 로컬 dev는 프로덕션 초대 도메인으로 (공유 링크가 실제 앱과 맞도록)
    if (o.includes('localhost') || o.includes('127.0.0.1')) {
      return 'https://pageby.stream';
    }
    return o.replace(/\/$/, '');
  }
  return 'https://pageby.stream';
}

export function normalizeInviteCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

export function isValidInviteCode(code: string): boolean {
  return code.length === 8 || /^\d{6}$/.test(code);
}

/** 공유용 초대 URL — 설치돼 있으면 앱, 없으면 스토어로 */
export function buildRoomInviteUrl(code: string): string {
  const c = normalizeInviteCode(code);
  return `${getInviteWebOrigin()}/join?code=${encodeURIComponent(c)}`;
}

export function setPendingRoomInvite(code: string) {
  const c = normalizeInviteCode(code);
  if (!isValidInviteCode(c)) return;
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, c);
  } catch {
    /* ignore */
  }
}

export function peekPendingRoomInvite(): string | null {
  try {
    const c = normalizeInviteCode(sessionStorage.getItem(PENDING_INVITE_KEY));
    return isValidInviteCode(c) ? c : null;
  } catch {
    return null;
  }
}

export function takePendingRoomInvite(): string | null {
  const c = peekPendingRoomInvite();
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* ignore */
  }
  return c;
}

/** URL·Flutter 주입에서 초대코드 추출 후 pending 저장. 반환: 코드 또는 null */
export function captureInviteFromLocation(): string | null {
  if (typeof window === 'undefined') return null;

  const fromFlutter = window.__diaryOpenFromInvite?.code;
  if (fromFlutter) {
    const c = normalizeInviteCode(fromFlutter);
    window.__diaryOpenFromInvite = undefined;
    if (isValidInviteCode(c)) {
      setPendingRoomInvite(c);
      return c;
    }
  }

  try {
    const url = new URL(window.location.href);
    let code = normalizeInviteCode(url.searchParams.get('code'));
    if (!isValidInviteCode(code) && url.pathname.startsWith('/join')) {
      const parts = url.pathname.split('/').filter(Boolean);
      // /join/CODE
      if (parts.length >= 2) code = normalizeInviteCode(parts[1]);
    }
    if (!isValidInviteCode(code)) return peekPendingRoomInvite();

    setPendingRoomInvite(code);
    // SPA 홈으로 정리 (히스토리만)
    if (url.pathname.startsWith('/join') || url.searchParams.has('code')) {
      window.history.replaceState({}, '', '/');
    }
    return code;
  } catch {
    return peekPendingRoomInvite();
  }
}

/**
 * 모바일 브라우저에서 앱 실행 시도 → 없으면 스토어.
 * 데스크톱은 스토어로 이동. Flutter WebView에서는 호출하지 않음.
 */
export function tryOpenAppOrStore(inviteCode: string) {
  if (typeof window === 'undefined' || isFlutterApp()) return;

  const code = normalizeInviteCode(inviteCode);
  if (!isValidInviteCode(code)) return;

  const ua = navigator.userAgent || '';
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  const install = getAppInstallUrl(code);

  if (!isMobile) {
    window.location.replace(install);
    return;
  }

  const host = getInviteWebOrigin().replace(/^https?:\/\//, '');
  const path = `join?code=${encodeURIComponent(code)}`;

  if (/android/i.test(ua)) {
    // 설치돼 있으면 앱, 없으면 browser_fallback_url(스토어)
    window.location.href =
      `intent://${host}/${path}` +
      `#Intent;scheme=https;package=com.yun.diary_app;` +
      `S.browser_fallback_url=${encodeURIComponent(install)};end`;
    return;
  }

  // iOS 등: 커스텀 스킴 시도 후 스토어
  window.location.href = `pageby://${path}`;
  window.setTimeout(() => {
    window.location.href = install;
  }, 1400);
}

declare global {
  interface Window {
    __diaryOpenFromInvite?: { code?: string };
  }
}
