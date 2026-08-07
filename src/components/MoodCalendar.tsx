import { useTranslation } from 'react-i18next';
import type { DiaryEntry, Mood } from '../types/diary';
import { MOOD_MAP } from '../types/diary';
import {
  applyCalendarDisplayMode,
  useCalendarDisplayMode,
} from '../utils/calendarDisplay';
import { formatYearMonth } from '../utils/date';
import MoodIcon from './MoodIcon';
import './MoodCalendar.css';

interface MoodCalendarProps {
  entries: DiaryEntry[];
  viewYear: number;
  viewMonth: number;
  onViewChange: (year: number, month: number) => void;
  onSelectDate?: (date: string) => void;
  hideHeader?: boolean;
}

interface DayMark {
  mood?: Mood;
  imageUrl?: string;
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const CALENDAR_CELLS = 42;

function MoodCalendar({
  entries,
  viewYear,
  viewMonth,
  onViewChange,
  onSelectDate,
  hideHeader = false,
}: MoodCalendarProps) {
  const { t } = useTranslation();
  const displayMode = useCalendarDisplayMode();
  const now = new Date();

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = toDateString(now.getFullYear(), now.getMonth(), now.getDate());

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < CALENDAR_CELLS) cells.push(null);

  const markByDate = new Map<string, DayMark>();
  for (const entry of entries) {
    if (markByDate.has(entry.date)) continue;
    const mood = MOOD_MAP[entry.mood] ? entry.mood : undefined;
    const imageUrl = entry.imageUrl?.trim() ? entry.imageUrl : undefined;
    if (mood || imageUrl) {
      markByDate.set(entry.date, { mood, imageUrl });
    }
  }

  const moveMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    onViewChange(d.getFullYear(), d.getMonth());
  };

  const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`common.weekday.${i}`));

  return (
    <div
      className={[
        'mood-cal',
        hideHeader ? 'mood-cal--no-header' : '',
        displayMode === 'drawing' ? 'mood-cal--drawing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mood-cal__toolbar">
        {!hideHeader ? (
          <div className="mood-cal__header">
            <button type="button" onClick={() => moveMonth(-1)} aria-label={t('calendar.prevMonth')}>
              ‹
            </button>
            <strong>{formatYearMonth(toDateString(viewYear, viewMonth, 1))}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label={t('calendar.nextMonth')}>
              ›
            </button>
          </div>
        ) : (
          <span className="mood-cal__display-label">{t('calendar.displayLabel')}</span>
        )}

        <div className="mood-cal__display" role="group" aria-label={t('calendar.displayAria')}>
          <button
            type="button"
            className={`mood-cal__display-btn ${displayMode === 'emoji' ? 'is-active' : ''}`}
            onClick={() => applyCalendarDisplayMode('emoji')}
          >
            {t('calendar.displayEmoji')}
          </button>
          <button
            type="button"
            className={`mood-cal__display-btn ${displayMode === 'drawing' ? 'is-active' : ''}`}
            onClick={() => applyCalendarDisplayMode('drawing')}
          >
            {t('calendar.displayDrawing')}
          </button>
        </div>
      </div>

      <div className="mood-cal__weekdays">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="mood-cal__days">
        {cells.map((day, i) => {
          if (day === null) {
            return <span key={`blank-${i}`} className="mood-cal__day mood-cal__day--blank" aria-hidden />;
          }
          const dateStr = toDateString(viewYear, viewMonth, day);
          const mark = markByDate.get(dateStr);
          const mood = mark?.mood;
          const imageUrl = mark?.imageUrl;
          const showDrawing = displayMode === 'drawing' && Boolean(imageUrl);
          const showMood = Boolean(mood) && !showDrawing;
          const isToday = dateStr === todayStr;

          return (
            <button
              key={dateStr}
              type="button"
              className={[
                'mood-cal__day',
                showDrawing ? 'has-drawing' : '',
                showMood ? 'has-mood' : '',
                isToday ? 'today' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate?.(dateStr)}
              aria-label={`${day}${mood ? ` ${t(`mood.${mood}`)}` : ''}`}
            >
              {showDrawing && imageUrl ? (
                <img
                  className="mood-cal__thumb"
                  src={imageUrl}
                  alt=""
                  draggable={false}
                />
              ) : showMood && mood ? (
                <MoodIcon mood={mood} />
              ) : (
                day
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MoodCalendar;
