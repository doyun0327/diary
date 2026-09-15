import type { AiPackProductId } from './aiPackProducts';
import type { SubProductId } from './subscriptionProducts';
import { SUB_MONTHLY_PRODUCT_ID } from './subscriptionProducts';

export type PendingNyangPurchase =
  | { kind: 'subscribe'; productId?: SubProductId }
  | { kind: 'pack'; productId: AiPackProductId };

let pending: PendingNyangPurchase | null = null;

export function setPendingNyangPurchase(next: PendingNyangPurchase) {
  pending = next;
}

export function clearPendingNyangPurchase() {
  pending = null;
}

export function takePendingNyangPurchase(): PendingNyangPurchase | null {
  const next = pending;
  pending = null;
  return next;
}

export function pendingSubscribeProductId(
  pendingPurchase: PendingNyangPurchase | null | undefined,
): SubProductId {
  if (pendingPurchase?.kind === 'subscribe' && pendingPurchase.productId) {
    return pendingPurchase.productId;
  }
  return SUB_MONTHLY_PRODUCT_ID;
}
