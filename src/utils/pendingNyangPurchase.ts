import type { AiPackProductId } from './aiPackProducts';

export type PendingNyangPurchase =
  | { kind: 'subscribe' }
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
