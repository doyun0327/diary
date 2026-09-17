/**
 * Cloudflare Worker — static SPA + 배포 중 유지보수 화면.
 * MAINTENANCE=1 이면 HTML 진입을 /updating.html 로 보내고,
 * /deploy-status.json 으로 열린 앱이 폴링할 수 있게 한다.
 * /join 초대 링크는 웹 SPA 입장 없이 앱·스토어로만 유도한다.
 */
export interface Env {
  ASSETS: Fetcher;
  MAINTENANCE?: string;
}

const PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.yun.diary_app';
const APP_HOST = 'pageby-diary.idoyun781.workers.dev';

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

function normalizeInviteCode(raw: string | null): string {
  return (raw ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

function extractInviteCode(url: URL): string {
  let code = normalizeInviteCode(url.searchParams.get('code'));
  if (code.length === 8) return code;
  // /join/CODE
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'join' && parts[1]) {
    code = normalizeInviteCode(parts[1]);
  }
  return code.length === 8 ? code : '';
}

function isJoinPath(pathname: string): boolean {
  return pathname === '/join' || pathname.startsWith('/join/');
}

/** 브라우저에서 초대 링크 → 앱 실행 시도, 없으면 스토어 (웹 SPA 미진입) */
function inviteBridgeHtml(code: string, requestUrl: URL): string {
  const store =
    `${PLAY_STORE}?referrer=${encodeURIComponent(`invite_code=${code}`)}`;
  const host = requestUrl.host || APP_HOST;
  const path = `join?code=${encodeURIComponent(code)}`;
  const intent =
    `intent://${host}/${path}` +
    `#Intent;scheme=https;package=com.yun.diary_app;` +
    `S.browser_fallback_url=${encodeURIComponent(store)};end`;
  const iosScheme = `pageby://${path}`;
  const codeSafe = code.replace(/[<>&"']/g, '');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex" />
  <title>PageBy — 앱에서 입장</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100dvh; display: grid; place-items: center;
      padding: 24px; font-family: "Pretendard", "Apple SD Gothic Neo", sans-serif;
      background: #fffdf7; color: #333; text-align: center;
    }
    .card { max-width: 360px; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { margin: 0 0 12px; line-height: 1.5; color: #666; font-size: 0.95rem; }
    .code {
      display: inline-block; margin: 8px 0 20px; padding: 8px 14px;
      border-radius: 10px; background: #f7efe0; font-weight: 700;
      letter-spacing: 0.12em; font-size: 1.05rem; color: #333;
    }
    a.btn {
      display: inline-block; padding: 12px 20px; border-radius: 12px;
      background: #e8a838; color: #fff; font-weight: 700; text-decoration: none;
    }
    .hint { margin-top: 16px; font-size: 0.82rem; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <h1>PageBy 앱에서 입장해 주세요</h1>
    <p>초대 링크는 웹이 아니라 앱에서만 들어갈 수 있어요.</p>
    <div class="code">${codeSafe || '········'}</div>
    <p><a class="btn" id="store" href="${store}">앱 열기 / 설치하기</a></p>
    <p class="hint">앱이 있으면 잠시 후 자동으로 열려요.</p>
  </div>
  <script>
    (function () {
      var code = ${JSON.stringify(code)};
      if (!code) return;
      var ua = navigator.userAgent || '';
      var store = ${JSON.stringify(store)};
      var intent = ${JSON.stringify(intent)};
      var ios = ${JSON.stringify(iosScheme)};
      if (/android/i.test(ua)) {
        location.replace(intent);
        return;
      }
      if (/iphone|ipad|ipod/i.test(ua)) {
        location.href = ios;
        setTimeout(function () { location.href = store; }, 1400);
        return;
      }
      setTimeout(function () { location.replace(store); }, 800);
    })();
  </script>
</body>
</html>`;
}

function inviteBridgeResponse(code: string, requestUrl: URL): Response {
  return new Response(inviteBridgeHtml(code, requestUrl), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex',
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

    // 초대 링크(/join 만) — 웹 SPA 미진입, 앱·스토어 유도
    // ※ 임의의 ?code= 는 OAuth 등과 충돌할 수 있어 /join 경로만 차단
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      isJoinPath(url.pathname)
    ) {
      return inviteBridgeResponse(extractInviteCode(url), url);
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
