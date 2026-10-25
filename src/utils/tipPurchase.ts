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

/** 앱에서만 츄르·AI 팩 등 소모성 결제 가능 */
export function requestTipPurchase(productId: TipProductId | string): boolean {
  if (!isFlutterApp()) return false;
  postDiaryNative({ type: 'tipPurchase', productId });
  return true;
}

type StoreProductsPayload = {
  products?: Array<{
    productId?: string;
    priceString?: string;
    currencyCode?: string;
    price?: string;
  }>;
};

export type StorePriceInfo = {
  /** 표시용 현지 가격 (예: "₩3,600", "$2.99") */
  prices: Record<string, string>;
  /** 숫자 가격 (현지 통화). 할인율 계산용 */
  amounts: Record<string, number>;
};

/** 스토어 현지 가격 조회 (앱이 아니면 빈 맵) */
export function fetchTipStorePrices(timeoutMs = 8_000): Promise<
  Record<string, string>
> {
  return fetchStorePriceInfo(timeoutMs).then((info) => info.prices);
}

/** 스토어 현지 가격 + 숫자 가격 조회 (앱이 아니면 빈 값) */
export function fetchStorePriceInfo(timeoutMs = 8_000): Promise<StorePriceInfo> {
  if (!isFlutterApp()) {
    return Promise.resolve({ prices: {}, amounts: {} });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (info: StorePriceInfo) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener(TIP_PRODUCTS_EVENT, onEvent);
      if (window.__onDiaryTipProducts === onBridge) {
        window.__onDiaryTipProducts = undefined;
      }
      resolve(info);
    };

    const parse = (payload: StoreProductsPayload | null | undefined) => {
      const prices: Record<string, string> = {};
      const amounts: Record<string, number> = {};
      for (const row of payload?.products ?? []) {
        const id = row.productId?.trim();
        const price = row.priceString?.trim();
        if (id && price) prices[id] = price;
        // 구버전 앱은 price 를 보내지 않음 → 할인율만 숨김
        const amount = Number(row.price);
        if (id && Number.isFinite(amount) && amount > 0) amounts[id] = amount;
      }
      finish({ prices, amounts });
    };

    const onBridge = (payload: StoreProductsPayload) => parse(payload);

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

    const timer = window.setTimeout(() => finish({ prices: {}, amounts: {} }), timeoutMs);
  });
}

/** 네이티브 결제 완료/취소까지 대기 */
export function waitForTipPurchase(
  productId: TipProductId | string,
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
      const got = (payload.productId ?? '').trim();
      const want = productId.trim();
      // 다른 상품 응답은 무시 (접미사 base plan 허용)
      if (
        got &&
        want &&
        got !== want &&
        !got.startsWith(`${want}:`) &&
        !want.startsWith(`${got}:`)
      ) {
        return;
      }
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
