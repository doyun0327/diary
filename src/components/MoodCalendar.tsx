import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
  selectedDate?: string;
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

const CALENDAR_MAX_WEEKS = 6;

/** 브라우저 디코드 완료된 썸네일 URL */
const preloadedThumbUrls = new Set<string>();

function preloadImage(url: string): Promise<void> {
  if (preloadedThumbUrls.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => {
      preloadedThumbUrls.add(url);
      resolve();
    };
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

function MoodCalendar({
  entries,
  viewYear,
  viewMonth,
  onViewChange,
  onSelectDate,
  selectedDate,
  hideHeader = false,
}: MoodCalendarProps) {
  const { t } = useTranslation();
  const now = new Date();

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = toDateString(now.getFullYear(), now.getMonth(), now.getDate());
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < weekCount * 7) cells.push(null);

  const markByDate = useMemo(() => {
    const map = new Map<string, DayMark>();
    for (const entry of entries) {
      if (!entry.date.startsWith(monthPrefix)) continue;
      if (map.has(entry.date)) continue;
      const sticker = entry.mood;
      const imageUrl = entry.imageUrl?.trim() ? entry.imageUrl : undefined;
      if (sticker || imageUrl) {
        map.set(entry.date, { sticker, moodPack: entry.moodPack, imageUrl });
      }
    }
    return map;
  }, [entries, monthPrefix]);

  const monthThumbUrls = useMemo(() => {
    const urls: string[] = [];
    const seen = new Set<string>();
    for (const mark of markByDate.values()) {
      const url = mark.imageUrl;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    return urls;
  }, [markByDate]);

  /** preload 완료 시 리렌더 — 모듈 Set만으로는 구독이 안 됨 */
  const [thumbReadyTick, setThumbReadyTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const missing = monthThumbUrls.filter((u) => !preloadedThumbUrls.has(u));
    if (missing.length === 0) {
      setThumbReadyTick((n) => n + 1);
      return;
    }
    // 이미 디코드된 URL은 그대로 두고, 새 URL만 프리로드 (전체 숨김 금지)
    void Promise.all(missing.map(preloadImage)).then(() => {
      if (!cancelled) setThumbReadyTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [monthThumbUrls]);

  void thumbReadyTick;

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

      <div
        className="mood-cal__days"
        style={
          {
            '--cal-weeks': weekCount,
            '--cal-max-weeks': CALENDAR_MAX_WEEKS,
          } as CSSProperties
        }
      >
        {cells.map((day, i) => {
          if (day === null) {
            return <span key={`blank-${i}`} className="mood-cal__day mood-cal__day--blank" aria-hidden />;
          }
          const dateStr = toDateString(viewYear, viewMonth, day);
          const mark = markByDate.get(dateStr);
          const sticker = mark?.sticker;
          const imageUrl = mark?.imageUrl;
          const showDrawing =
            Boolean(imageUrl) && preloadedThumbUrls.has(imageUrl!);
          const showMood = Boolean(sticker) && !showDrawing;
          const isToday = dateStr === todayStr;
          const isSelected = Boolean(selectedDate) && dateStr === selectedDate;
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
                isSelected ? 'selected' : '',
              ].filter(Boolean).join(' ')}
              aria-pressed={isSelected || undefined}
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
