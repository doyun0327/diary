/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** 친구 초대 공유 시 설치/웹 진입 URL (없으면 현재 origin) */
  readonly VITE_APP_SHARE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
