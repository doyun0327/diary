import { isFlutterApp, postDiaryNative } from './nativeShare';
import type { TipProductId } from './tipProducts';

export type TipPurchaseResult = {
  ok: boolean;
  cancelled?: boolean;
  productId?: string | null;
  error?: string | null;
};

export type TipStorePrice = {
  productId: string;
  priceString: string;
  currencyCode?: string;
};

export const TIP_PURCHASE_COMPLETE_EVENT = 'diary-tip-purchase-complete';
export const TIP_PRODUCTS_EVENT = 'diary-tip-products';

/** 앱에서만 츄르 결제 가능 */
export function requestTipPurchase(productId: TipProductId): boolean {
  if (!isFlutterApp()) return false;
  postDiaryNative({ type: 'tipPurchase', productId });
  return true;
}

/** 스토어 현지 가격 조회 (앱이 아니면 빈 맵) */
export function fetchTipStorePrices(timeoutMs = 8_000): Promise<
  Record<string, string>
> {
  if (!isFlutterApp()) {
    return Promise.resolve({});
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (prices: Record<string, string>) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener(TIP_PRODUCTS_EVENT, onEvent);
      if (window.__onDiaryTipProducts === onBridge) {
        window.__onDiaryTipProducts = undefined;
      }
      resolve(prices);
    };

    const parse = (payload: {
      products?: Array<{
        productId?: string;
        priceString?: string;
        currencyCode?: string;
      }>;
    } | null | undefined) => {
      const map: Record<string, string> = {};
      for (const row of payload?.products ?? []) {
        const id = row.productId?.trim();
        const price = row.priceString?.trim();
        if (id && price) map[id] = price;
      }
      finish(map);
    };

    const onBridge = (payload: {
      products?: Array<{
        productId?: string;
        priceString?: string;
        currencyCode?: string;
      }>;
    }) => parse(payload);

    const onEvent = (event: Event) => {
      parse((event as CustomEvent<{ products?: TipStorePrice[] }>).detail);
    };

    const prev = window.__onDiaryTipProducts;
    window.__onDiaryTipProducts = (payload) => {
      prev?.(payload);
      onBridge(payload);
    };
    window.addEventListener(TIP_PRODUCTS_EVENT, onEvent);

    postDiaryNative({ type: 'tipProducts' });

    const timer = window.setTimeout(() => finish({}), timeoutMs);
  });
}

/** 네이티브 결제 완료/취소까지 대기 */
export function waitForTipPurchase(
  productId: TipProductId,
  timeoutMs = 60_000,
): Promise<TipPurchaseResult> {
  if (!isFlutterApp()) {
    return Promise.resolve({ ok: false, error: 'app_only' });
  }

  return new Promise((resolve) => {
    let settled = false;
    const prev = window.__onDiaryTipPurchaseComplete;

    const finish = (result: TipPurchaseResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener(TIP_PURCHASE_COMPLETE_EVENT, onEvent);
      if (window.__onDiaryTipPurchaseComplete === wrapped) {
        window.__onDiaryTipPurchaseComplete = prev;
      }
      resolve(result);
    };

    const handle = (payload: TipPurchaseResult | undefined) => {
      if (!payload) return;
      // 한 번에 하나만 결제하므로 productId가 달라도 응답은 수용
      // (스토어가 base plan 접미사를 붙이는 경우 대비)
      finish({
        ok: Boolean(payload.ok),
        cancelled: Boolean(payload.cancelled),
        productId: payload.productId ?? productId,
        error: payload.error ?? null,
      });
    };

    const wrapped = (payload: TipPurchaseResult) => {
      prev?.(payload);
      handle(payload);
    };
    const onEvent = (event: Event) => {
      handle((event as CustomEvent<TipPurchaseResult>).detail);
    };

    window.__onDiaryTipPurchaseComplete = wrapped;
    window.addEventListener(TIP_PURCHASE_COMPLETE_EVENT, onEvent);

    if (!requestTipPurchase(productId)) {
      finish({ ok: false, error: 'app_only' });
      return;
    }

    const timer = window.setTimeout(
      () => finish({ ok: false, productId, error: 'timeout' }),
      timeoutMs,
    );
  });
}
