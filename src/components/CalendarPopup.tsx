import { useState } from 'react';
import './CalendarPopup.css';

interface CalendarPopupProps {
  /** 선택된 날짜 (YYYY-MM-DD) */
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function CalendarPopup({ value, onSelect, onClose }: CalendarPopupProps) {
  const selected = new Date(`${value}T00:00:00`);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const now = new Date();
  const todayStr = toDateString(now.getFullYear(), now.getMonth(), now.getDate());

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const moveMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const goToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onSelect(todayStr);
  };

  return (
    <>
      <div className="calendar__backdrop" onClick={onClose} />
      <div className="calendar" role="dialog" aria-label="날짜 선택">
        <div className="calendar__header">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
            ‹
          </button>
          <strong>
            {viewYear}년 {viewMonth + 1}월
          </strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달">
            ›
          </button>
        </div>

        <div className="calendar__weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="calendar__days">
          {cells.map((day, i) => {
            if (day === null) {
              return <span key={`blank-${i}`} />;
            }
            const dateStr = toDateString(viewYear, viewMonth, day);
            const classNames = [
              'calendar__day',
              dateStr === value ? 'selected' : '',
              dateStr === todayStr ? 'today' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={dateStr}
                type="button"
                className={classNames}
                onClick={() => onSelect(dateStr)}
              >
                {day}
              </button>
            );
          })}
        </div>

        <button type="button" className="calendar__today-btn" onClick={goToday}>
          오늘로 이동
        </button>
      </div>
    </>
  );
}

export default CalendarPopup;
