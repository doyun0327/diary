/**
 * Cloudflare Worker — static SPA + 배포 중 유지보수 화면.
 * MAINTENANCE=1 이면 HTML 진입을 /updating.html 로 보내고,
 * /deploy-status.json 으로 열린 앱이 폴링할 수 있게 한다.
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

/** WebView는 Accept에 text/html이 없을 때가 많아, 문서 경로면 HTML로 본다 */
function looksLikeDocumentRequest(request: Request, pathname: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (isUpdatingAsset(pathname)) return false;
  if (pathname === '/deploy-status.json') return false;

  const accept = (request.headers.get('Accept') ?? '').toLowerCase();
  if (accept.includes('text/html') || accept.includes('*/*') || accept === '') {
    const dest = request.headers.get('Sec-Fetch-Dest');
    if (dest === 'image' || dest === 'script' || dest === 'style' || dest === 'font') {
      return false;
    }
  } else if (
    accept.includes('application/json') ||
    accept.includes('image/') ||
    accept.includes('text/css') ||
    accept.includes('javascript')
  ) {
    return false;
  }

  if (pathname === '/' || pathname === '') return true;
  if (pathname.endsWith('.html')) return true;
  const last = pathname.split('/').pop() ?? '';
  // 확장자 없는 SPA 경로
  return !last.includes('.');
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
      if (looksLikeDocumentRequest(request, url.pathname)) {
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
