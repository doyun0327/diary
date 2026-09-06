/**
 * Cloudflare Worker — static SPA + 배포 중 유지보수 화면.
 * MAINTENANCE=1 이면 HTML 진입을 /updating.html 로 보냄.
 */
export interface Env {
  ASSETS: Fetcher;
  MAINTENANCE?: string;
}

function maintenanceOn(env: Env): boolean {
  const v = (env.MAINTENANCE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

function isUpdatingAsset(pathname: string): boolean {
  return (
    pathname === '/updating.html' ||
    pathname === '/favicon.svg' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/lottie/')
  );
}

function wantsHtml(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('Accept') ?? '';
  if (accept.includes('text/html')) return true;
  // 주소창·WebView 직접 진입
  const dest = request.headers.get('Sec-Fetch-Dest');
  return dest === 'document' || dest === null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (maintenanceOn(env)) {
      if (isUpdatingAsset(url.pathname)) {
        return env.ASSETS.fetch(request);
      }
      if (wantsHtml(request)) {
        const updating = new URL('/updating.html', url.origin);
        return env.ASSETS.fetch(new Request(updating, request));
      }
      return new Response('Service updating', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Retry-After': '120',
          'Cache-Control': 'no-store',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
