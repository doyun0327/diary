import { useTranslation } from 'react-i18next';
import type { DiaryEntry, DiarySticker } from '../types/diary';
import { isMood } from '../types/diary';
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
  sticker?: DiarySticker;
  moodPack?: DiaryEntry['moodPack'];
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
    const sticker = entry.mood;
    const imageUrl = entry.imageUrl?.trim() ? entry.imageUrl : undefined;
    if (sticker || imageUrl) {
      markByDate.set(entry.date, { sticker, moodPack: entry.moodPack, imageUrl });
    }
  }

  const moveMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    onViewChange(d.getFullYear(), d.getMonth());
  };

  const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`common.weekday.${i}`));

  return (
    <div className={`mood-cal mood-cal--drawing${hideHeader ? ' mood-cal--no-header' : ''}`}>
      {!hideHeader && (
        <div className="mood-cal__toolbar">
          <div className="mood-cal__header">
            <button type="button" onClick={() => moveMonth(-1)} aria-label={t('calendar.prevMonth')}>
              ‹
            </button>
            <strong>{formatYearMonth(toDateString(viewYear, viewMonth, 1))}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label={t('calendar.nextMonth')}>
              ›
            </button>
          </div>
        </div>
      )}

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
          const sticker = mark?.sticker;
          const imageUrl = mark?.imageUrl;
          const showDrawing = Boolean(imageUrl);
          const showMood = Boolean(sticker) && !showDrawing;
          const isToday = dateStr === todayStr;
          const moodLabel = sticker
            ? isMood(sticker)
              ? t(`mood.${sticker}`)
              : sticker
            : '';

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
              aria-label={`${day}${moodLabel ? ` ${moodLabel}` : ''}`}
            >
              {showDrawing && imageUrl ? (
                <img
                  className="mood-cal__thumb"
                  src={imageUrl}
                  alt=""
                  draggable={false}
                />
              ) : showMood && sticker ? (
                <MoodIcon mood={sticker} packId={mark?.moodPack} />
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
