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
function wantsHtml(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/html")) return true;
  const dest = request.headers.get("Sec-Fetch-Dest");
  return dest === "document" || dest === null;
}
__name(wantsHtml, "wantsHtml");
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
      if (wantsHtml(request)) {
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
