/**
 * Cloudflare Worker — static SPA + 배포 중 유지보수 화면.
 * MAINTENANCE=1 이면 HTML 진입을 /updating.html 로 보내고,
 * /deploy-status.json 으로 열린 앱이 폴링할 수 있게 한다.!
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
  const dest = request.headers.get('Sec-Fetch-Dest');
  return dest === 'document' || dest === null;
}

function statusJson(maintenance: boolean): Response {
  return new Response(JSON.stringify({ maintenance }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const on = maintenanceOn(env);

    // 열린 앱이 폴링 — maintenance 중에도 항상 200
    if (url.pathname === '/deploy-status.json') {
      return statusJson(on);
    }

    if (on) {
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
