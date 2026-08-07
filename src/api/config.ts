/**
 * API base URL
 * - 개발: 빈 문자열 → Vite가 /api 를 localhost:8080 으로 프록시
 * - 프로덕션(build): .env.production 의 VITE_API_BASE_URL (배포된 백엔드)
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.replace(/\/$/, '') ?? '';

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export function isRemoteApi(): boolean {
  return Boolean(API_BASE_URL);
}
