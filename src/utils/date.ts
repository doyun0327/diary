const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** YYYY-MM-DD → "yyyy년 mm월 dd일 x요일" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
  return `${y}년 ${m}월 ${d}일 ${weekday}요일`;
}

/** 오늘 날짜 (YYYY-MM-DD) */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
