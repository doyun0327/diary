var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.ts
var PLAY_STORE = "https://play.google.com/store/apps/details?id=com.yun.diary_app";
var APP_HOST = "pageby-diary.idoyun781.workers.dev";
function maintenanceOn(env) {
  const v = (env.MAINTENANCE ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}
__name(maintenanceOn, "maintenanceOn");
function isUpdatingAsset(pathname) {
  return pathname === "/updating.html" || pathname === "/favicon.svg" || pathname === "/favicon.ico" || pathname.startsWith("/lottie/");
}
__name(isUpdatingAsset, "isUpdatingAsset");
function looksLikeDocumentRequest(request, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (isUpdatingAsset(pathname)) return false;
  if (pathname === "/deploy-status.json") return false;
  const accept = (request.headers.get("Accept") ?? "").toLowerCase();
  if (accept.includes("text/html") || accept.includes("*/*") || accept === "") {
    const dest = request.headers.get("Sec-Fetch-Dest");
    if (dest === "image" || dest === "script" || dest === "style" || dest === "font") {
      return false;
    }
  } else if (accept.includes("application/json") || accept.includes("image/") || accept.includes("text/css") || accept.includes("javascript")) {
    return false;
  }
  if (pathname === "/" || pathname === "") return true;
  if (pathname.endsWith(".html")) return true;
  const last = pathname.split("/").pop() ?? "";
  return !last.includes(".");
}
__name(looksLikeDocumentRequest, "looksLikeDocumentRequest");
function statusJson(maintenance) {
  return new Response(JSON.stringify({ maintenance }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
__name(statusJson, "statusJson");
function normalizeInviteCode(raw) {
  return (raw ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
}
__name(normalizeInviteCode, "normalizeInviteCode");
function extractInviteCode(url) {
  let code = normalizeInviteCode(url.searchParams.get("code"));
  if (code.length === 8) return code;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "join" && parts[1]) {
    code = normalizeInviteCode(parts[1]);
  }
  return code.length === 8 ? code : "";
}
__name(extractInviteCode, "extractInviteCode");
function isJoinPath(pathname) {
  return pathname === "/join" || pathname.startsWith("/join/");
}
__name(isJoinPath, "isJoinPath");
function inviteBridgeHtml(code, requestUrl) {
  const store = `${PLAY_STORE}?referrer=${encodeURIComponent(`invite_code=${code}`)}`;
  const host = requestUrl.host || APP_HOST;
  const path = `join?code=${encodeURIComponent(code)}`;
  const intent = `intent://${host}/${path}#Intent;scheme=https;package=com.yun.diary_app;S.browser_fallback_url=${encodeURIComponent(store)};end`;
  const iosScheme = `pageby://${path}`;
  const codeSafe = code.replace(/[<>&"']/g, "");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex" />
  <title>PageBy \u2014 \uC571\uC5D0\uC11C \uC785\uC7A5</title>
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
    <h1>PageBy \uC571\uC5D0\uC11C \uC785\uC7A5\uD574 \uC8FC\uC138\uC694</h1>
    <p>\uCD08\uB300 \uB9C1\uD06C\uB294 \uC6F9\uC774 \uC544\uB2C8\uB77C \uC571\uC5D0\uC11C\uB9CC \uB4E4\uC5B4\uAC08 \uC218 \uC788\uC5B4\uC694.</p>
    <div class="code">${codeSafe || "\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7"}</div>
    <p><a class="btn" id="store" href="${store}">\uC571 \uC5F4\uAE30 / \uC124\uCE58\uD558\uAE30</a></p>
    <p class="hint">\uC571\uC774 \uC788\uC73C\uBA74 \uC7A0\uC2DC \uD6C4 \uC790\uB3D9\uC73C\uB85C \uC5F4\uB824\uC694.</p>
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
  <\/script>
</body>
</html>`;
}
__name(inviteBridgeHtml, "inviteBridgeHtml");
function inviteBridgeResponse(code, requestUrl) {
  return new Response(inviteBridgeHtml(code, requestUrl), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex"
    }
  });
}
__name(inviteBridgeResponse, "inviteBridgeResponse");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const on = maintenanceOn(env);
    if (url.pathname === "/deploy-status.json") {
      return statusJson(on);
    }
    if ((request.method === "GET" || request.method === "HEAD") && isJoinPath(url.pathname)) {
      return inviteBridgeResponse(extractInviteCode(url), url);
    }
    if (on) {
      if (isUpdatingAsset(url.pathname)) {
        return env.ASSETS.fetch(request);
      }
      if (looksLikeDocumentRequest(request, url.pathname)) {
        const updating = new URL("/updating.html", url.origin);
        return env.ASSETS.fetch(new Request(updating, request));
      }
      return new Response("Service updating", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": "120",
          "Cache-Control": "no-store"
        }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
