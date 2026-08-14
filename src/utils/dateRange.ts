import type { DiaryEntry } from '../types/diary';

export type DateRange = {
  start: string;
  end: string;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function localTodayParts(now = new Date()) {
  return {
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    d: now.getDate(),
  };
}

/** 이번 달 1일 ~ 말일 (YYYY-MM-DD) */
export function thisMonthRange(now = new Date()): DateRange {
  const { y, m } = localTodayParts(now);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: toYmd(y, m, 1), end: toYmd(y, m, lastDay) };
}

/** 지난달 1일 ~ 말일 */
export function lastMonthRange(now = new Date()): DateRange {
  const { y, m } = localTodayParts(now);
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const lastDay = new Date(prev.y, prev.m, 0).getDate();
  return { start: toYmd(prev.y, prev.m, 1), end: toYmd(prev.y, prev.m, lastDay) };
}

/** entry.date 기준 inclusive 필터 (날짜 오름차순) */
export function filterEntriesByDateRange(
  entries: DiaryEntry[],
  start: string,
  end: string,
): DiaryEntry[] {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  return entries
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function monthStartYmd(year: number, monthIndex: number): string {
  return toYmd(year, monthIndex + 1, 1);
}

export function monthEndYmd(year: number, monthIndex: number): string {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return toYmd(year, monthIndex + 1, lastDay);
}

export function yearMonthFromYmd(ymd: string): { year: number; month: number } {
  return {
    year: Number(ymd.slice(0, 4)),
    month: Number(ymd.slice(5, 7)) - 1,
  };
}

function ymdDigits(ymd: string): string {
  return ymd.replace(/-/g, '');
}

/** PDF 파일명: pageByYYYYMMDD-YYYYMMDD.pdf */
export function exportPdfFilename(start: string, end: string): string {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  return `pageBy${ymdDigits(from)}-${ymdDigits(to)}.pdf`;
}
