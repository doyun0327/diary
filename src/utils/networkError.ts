const NETWORK_ERROR_HINTS = [
  '서버에 연결하지 못했어요',
  'Failed to fetch',
  'NetworkError',
  'Network request failed',
  'Load failed',
];

export function isNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return NETWORK_ERROR_HINTS.some((hint) => message.includes(hint));
}

export function resolveNetworkErrorTitle(
  err: unknown,
  networkTitle: string,
  fallback: string,
): string {
  if (isNetworkError(err)) return networkTitle;
  return err instanceof Error ? err.message : fallback;
}
