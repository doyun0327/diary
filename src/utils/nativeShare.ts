declare global {
  interface Window {
    DiaryNative?: { postMessage: (message: string) => void };
    __DIARY_FLUTTER__?: boolean;
    /** Flutter 주입 — 재설치에도 유지되는 기기 키 (설치 무료 AI) */
    __DIARY_NATIVE_DEVICE_KEY__?: string;
    /** true면 Flutter AppBar를 숨겨야 함 (친구방·상세 등) */
    __diaryHideNativeChrome?: boolean;
    __onDiaryGoogleIdToken?: (idToken: string) => void;
    __onDiaryGoogleSignInError?: (reason: string) => void;
    diaryGoBack?: () => boolean;
    diaryHeaderAction?: (action: string, payload?: { year?: number; month?: number }) => void;
    __onDiarySubscriptionStatus?: (payload: {
      active: boolean;
      expiresAt: number | null;
      productId?: string | null;
    }) => void;
    /** 결제 완료 직후 Flutter → WebView (Pro 상태 즉시 반영) */
    __onDiarySubscriptionPurchaseComplete?: (payload: {
      active: boolean;
      expiresAt: number | null;
      productId?: string | null;
    }) => void;
    /** 구매 복원 결과 */
    __onDiarySubscriptionRestore?: (payload: {
      ok: boolean;
      active: boolean;
      error?: string | null;
    }) => void;
    __onDiaryRewardedAd?: (payload: { ok: boolean; reason?: string; error?: string }) => void;
    __onDiaryTipPurchaseComplete?: (payload: {
      ok: boolean;
      cancelled?: boolean;
      productId?: string | null;
      error?: string | null;
    }) => void;
    __onDiaryTipProducts?: (payload: {
      products?: Array<{
        productId?: string;
        priceString?: string;
        currencyCode?: string;
        /** 숫자 가격 문자열 (현지 통화, 예: "3600.0") */
        price?: string;
      }>;
    }) => void;
  }
}

function diaryNative(): { postMessage: (message: string) => void } | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.DiaryNative ?? (globalThis as unknown as { DiaryNative?: typeof window.DiaryNative }).DiaryNative;
}

export function isFlutterApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__DIARY_FLUTTER__ === true) return true;
  return typeof diaryNative()?.postMessage === 'function';
}

/** Flutter가 주입한 설치 기기 키 (없으면 null) */
export function getNativeInstallDeviceKey(): string | null {
  if (typeof window === 'undefined') return null;
  const key = window.__DIARY_NATIVE_DEVICE_KEY__;
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  return trimmed ? trimmed : null;
}

/** iOS Flutter 앱 (WKWebView). Apple 로그인 버튼 노출 등 iOS 전용 분기에 사용 */
export function isIOSApp(): boolean {
  if (!isFlutterApp()) return false;
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function postDiaryNative(data: Record<string, unknown>) {
  const native = diaryNative();
  if (!native) return;
  native.postMessage(JSON.stringify(data));
}

/** 백그라운드에서 AI 그림 완료 시 로컬 알림 (다운로드 알림과 동일 채널 패턴) */
export function notifyAiDrawComplete(payload?: {
  title?: string;
  body?: string;
}) {
  if (!isFlutterApp()) return;
  postDiaryNative({
    type: 'aiDrawComplete',
    title: payload?.title ?? '그림이 완성되었어요!',
    body: payload?.body ?? '그림을 확인해 보세요.💛',
  });
}

/** 실패 이유 (신규 앱 빌드만 보냄): no_ad = 보여 줄 광고 없음, dismissed = 끝까지 안 보고 닫음 */
export type RewardedAdError = "no_ad" | "dismissed";

export interface RewardedAdResult {
  ok: boolean;
  error?: RewardedAdError;
}

export async function requestAiRewardedAd(): Promise<RewardedAdResult> {
  return requestRewardedAd("aiDraw");
}

export async function requestDiaryRewardedAd(): Promise<boolean> {
  return (await requestRewardedAd("diarySave")).ok;
}

type RewardedAdPayload = { ok?: boolean; reason?: string; error?: string };

function toRewardedAdResult(payload?: RewardedAdPayload | null): RewardedAdResult {
  const ok = Boolean(payload?.ok);
  const error = payload?.error === "no_ad" || payload?.error === "dismissed" ? payload.error : undefined;
  return ok ? { ok } : { ok, error };
}

async function requestRewardedAd(
  reason: "aiDraw" | "diarySave",
): Promise<RewardedAdResult> {
  if (!isFlutterApp()) return { ok: false };

  return new Promise<RewardedAdResult>((resolve) => {
    let done = false;
    const prev = window.__onDiaryRewardedAd;

    const onCustom = (event: Event) => {
      finish(toRewardedAdResult((event as CustomEvent<RewardedAdPayload>).detail));
    };

    function finish(result: RewardedAdResult) {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("diary-rewarded-ad-result", onCustom);
      window.__onDiaryRewardedAd = prev;
      resolve(result);
    }

    window.__onDiaryRewardedAd = (payload) => finish(toRewardedAdResult(payload));
    window.addEventListener("diary-rewarded-ad-result", onCustom);
    postDiaryNative({ type: "rewardedAdShow", reason });

    // 네이티브 응답이 유실되면 웹이 영원히 멈추지 않게
    const timer = window.setTimeout(() => finish({ ok: false, error: "no_ad" }), 180_000);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Flutter WebView면 네이티브 공유 시트로 넘기고 true. 아니면 false. */
export async function shareViaNative(payload: {
  title?: string;
  text?: string;
  url?: string;
  file?: Blob;
  filename?: string;
}): Promise<boolean> {
  if (!isFlutterApp()) return false;

  if (payload.file) {
    const filename =
      payload.filename ||
      (payload.file instanceof File && payload.file.name) ||
      'share.bin';
    const lower = filename.toLowerCase();
    const mime =
      payload.file.type ||
      (lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
          ? 'image/jpeg'
          : lower.endsWith('.webp')
            ? 'image/webp'
            : lower.endsWith('.pdf')
              ? 'application/pdf'
              : 'application/octet-stream');
    diaryNative()!.postMessage(
      JSON.stringify({
        type: 'shareFile',
        title: payload.title ?? '',
        text: payload.text ?? '',
        url: payload.url ?? '',
        name: filename,
        mime,
        base64: await blobToBase64(payload.file),
      }),
    );
    return true;
  }

  diaryNative()!.postMessage(
    JSON.stringify({
      type: 'share',
      title: payload.title ?? '',
      text: payload.text ?? '',
      url: payload.url ?? '',
    }),
  );
  return true;
}

/** Flutter WebView면 네이티브 다운로드로 넘기고 true. 아니면 false. */
export async function saveFileViaNative(payload: {
  file: Blob;
  filename?: string;
}): Promise<boolean> {
  if (!isFlutterApp()) return false;

  const filename =
    payload.filename ||
    (payload.file instanceof File && payload.file.name) ||
    'download.bin';
  const lower = filename.toLowerCase();
  const mime =
    payload.file.type ||
    (lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.pdf')
            ? 'application/pdf'
            : 'application/octet-stream');
  try {
    diaryNative()!.postMessage(
      JSON.stringify({
        type: 'saveFile',
        name: filename,
        mime,
        base64: await blobToBase64(payload.file),
      }),
    );
    return true;
  } catch (err) {
    console.warn('[native] saveFile postMessage failed', err);
    return false;
  }
}
