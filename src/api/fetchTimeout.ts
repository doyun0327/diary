/** WebView·구형 브라우저에서도 동작하는 fetch 타임아웃 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const fromUser = init?.signal;
  if (fromUser) {
    if (fromUser.aborted) {
      controller.abort(fromUser.reason);
    } else {
      fromUser.addEventListener('abort', () => controller.abort(fromUser.reason), {
        once: true,
      });
    }
  }

  const timer = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('서버 응답이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** 인증·방 목록 등 UI를 막는 짧은 요청 (콜드스타트 여유) */
export const API_UI_TIMEOUT_MS = 20_000;

/** 앱 기동 시 백엔드 깨우기용 */
export const API_WARMUP_TIMEOUT_MS = 25_000;
