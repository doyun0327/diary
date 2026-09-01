import i18n from '../i18n';

/** YYYY-MM-DD → 현재 언어 날짜 문자열 */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  const weekday = i18n.t(`common.weekday.${new Date(`${date}T00:00:00`).getDay()}`);
  return i18n.t('common.dateFull', { y, m, d, weekday });
}

/** YYYY-MM 또는 (year, month0) → 현재 언어 연월 */
export function formatYearMonth(
  yearOrDate: number | string,
  monthIndex?: number,
): string {
  if (typeof yearOrDate === 'string') {
    const [y, m] = yearOrDate.split('-');
    return i18n.t('common.yearMonth', { y, m });
  }
  return i18n.t('common.yearMonth', {
    y: String(yearOrDate),
    m: String((monthIndex ?? 0) + 1).padStart(2, '0'),
  });
}

/** 오늘 날짜 (YYYY-MM-DD, 로컬 타임존) */
export function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 달력·동기화용 YYYY-MM */
export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
