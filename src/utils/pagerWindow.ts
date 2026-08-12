/** 0-based page index window (e.g. 5 pages at a time: 1–5, 6–10, …) */
export function getPagerWindow(
  page: number,
  pageCount: number,
  windowSize = 5,
): number[] {
  if (pageCount <= 0) return [];
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const windowStart = Math.floor(safePage / windowSize) * windowSize;
  const windowEnd = Math.min(pageCount, windowStart + windowSize);
  return Array.from({ length: windowEnd - windowStart }, (_, i) => windowStart + i);
}
