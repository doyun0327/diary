/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** 친구 초대 — 미설치 시 Play 스토어 URL */
  readonly VITE_APP_SHARE_URL?: string;
  /** 친구 초대 — iPhone/iPad 미설치 시 App Store URL (기본: id6826569891) */
  readonly VITE_APP_IOS_SHARE_URL?: string;
  /** 초대 딥링크 웹 origin (예: https://pageby.stream) */
  readonly VITE_APP_WEB_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
