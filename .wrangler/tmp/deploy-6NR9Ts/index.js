var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.ts
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
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const on = maintenanceOn(env);
    if (url.pathname === "/deploy-status.json") {
      return statusJson(on);
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
