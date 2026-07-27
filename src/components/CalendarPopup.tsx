import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatYearMonth } from '../utils/date';
import './CalendarPopup.css';

interface CalendarPopupProps {
  /** 선택된 날짜 (YYYY-MM-DD) */
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function CalendarPopup({ value, onSelect, onClose }: CalendarPopupProps) {
  const { t } = useTranslation();
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

  const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`common.weekday.${i}`));

  return (
    <>
      <div className="calendar__backdrop" onClick={onClose} />
      <div className="calendar" role="dialog" aria-label={t('calendar.dialogAria')}>
        <div className="calendar__header">
          <button type="button" onClick={() => moveMonth(-1)} aria-label={t('calendar.prevMonth')}>
            ‹
          </button>
          <strong>
            {formatYearMonth(toDateString(viewYear, viewMonth, 1))}
          </strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label={t('calendar.nextMonth')}>
            ›
          </button>
        </div>

        <div className="calendar__weekdays">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
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
          {t('calendar.goToday')}
        </button>
      </div>
    </>
  );
}

export default CalendarPopup;
