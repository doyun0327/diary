import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import MoodCalendar from '../components/MoodCalendar';
import DiaryListRow from '../components/DiaryListRow';
import CoachBubble from '../components/CoachBubble';
import {
  isTodayCellCoachSeen,
  markTodayCellCoachSeen,
} from '../utils/onboarding';
import { formatYearMonth, today } from '../utils/date';
import './DiaryListPage.css';

const PREVIEW_LIMIT = 3;
const SWIPE_MIN_DX = 56;
const SWIPE_MAX_DY = 110;

interface DiaryListPageProps {
  entries: DiaryEntry[];
  onSelect: (id: string) => void;
  /** 일기가 없는 날짜 — 새 일기 쓰기 */
  onWriteDate: (date: string) => void;
  viewYear: number;
  viewMonth: number;
  onViewChange: (year: number, month: number) => void;
  selectedDate?: string;
  highlightDate?: string | null;
  onSelectDate?: (date: string) => void;
}

function DiaryListPage({
  entries,
  onSelect,
  onWriteDate,
  viewYear,
  viewMonth,
  onViewChange,
  selectedDate,
  highlightDate,
  onSelectDate,
}: DiaryListPageProps) {
  const { t } = useTranslation();
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const sectionRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [showCoach, setShowCoach] = useState(
    () => entries.length === 0 && !isTodayCellCoachSeen(),
  );
  const todayStr = today();

  const monthEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date.startsWith(monthPrefix))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, monthPrefix],
  );

  useEffect(() => {
    setExpanded(false);
  }, [monthPrefix]);

  useEffect(() => {
    if (entries.length > 0) {
      setShowCoach(false);
      return;
    }
    if (!isTodayCellCoachSeen()) setShowCoach(true);
  }, [entries.length]);

  const coachVisible = showCoach && entries.length === 0;

  // 코치 중에는 오늘이 보이도록 이번 달로 맞춤
  useEffect(() => {
    if (!coachVisible) return;
    const [y, m] = todayStr.split('-').map(Number);
    if (viewYear !== y || viewMonth !== m - 1) {
      onViewChange(y, m - 1);
    }
  }, [coachVisible, todayStr, viewYear, viewMonth, onViewChange]);

  const moveMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    onViewChange(d.getFullYear(), d.getMonth());
  };

  const onMonthSwipeStart = (clientX: number, clientY: number) => {
    swipeStartRef.current = { x: clientX, y: clientY };
    suppressClickRef.current = false;
  };

  const onMonthSwipeMove = (clientX: number, clientY: number) => {
    const start = swipeStartRef.current;
    if (!start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      suppressClickRef.current = true;
    }
  };

  const onMonthSwipeEnd = (clientX: number, clientY: number) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    if (
      Math.abs(dx) < SWIPE_MIN_DX ||
      Math.abs(dy) > SWIPE_MAX_DY ||
      Math.abs(dx) <= Math.abs(dy) * 1.15
    ) {
      return;
    }
    suppressClickRef.current = true;
    // 왼쪽 스와이프 → 다음 달, 오른쪽 스와이프 → 이전 달
    moveMonth(dx < 0 ? 1 : -1);
  };

  // 스와이프 직후 날짜 칸 클릭이 따라오지 않게
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClickRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    };
    root.addEventListener('click', onClickCapture, true);
    return () => root.removeEventListener('click', onClickCapture, true);
  }, []);

  const hiddenCount = Math.max(0, monthEntries.length - PREVIEW_LIMIT);
  const visibleEntries = expanded ? monthEntries : monthEntries.slice(0, PREVIEW_LIMIT);

  const dismissCoach = () => {
    markTodayCellCoachSeen();
    setShowCoach(false);
  };

  const handleCalendarDate = (date: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelectDate?.(date);
    const entry = entries.find((e) => e.date === date);
    if (entry) {
      if (showCoach) dismissCoach();
      onSelect(entry.id);
      return;
    }
    if (showCoach) dismissCoach();
    onWriteDate(date);
  };

  const handleCollapse = () => {
    setExpanded(false);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const monthLabel = formatYearMonth(monthPrefix);

  return (
    <div
      ref={rootRef}
      className={`diary-list${entries.length === 0 ? ' diary-list--empty' : ''}`}
      data-no-swipe
      onTouchStart={(e) => {
        if (e.touches.length !== 1) return;
        if ((e.target as Element | null)?.closest?.('.coach-bubble__dismiss')) {
          swipeStartRef.current = null;
          return;
        }
        onMonthSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchMove={(e) => {
        if (e.touches.length !== 1 || !swipeStartRef.current) return;
        onMonthSwipeMove(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchEnd={(e) => {
        if (e.changedTouches.length !== 1) return;
        onMonthSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }}
      onTouchCancel={() => {
        swipeStartRef.current = null;
      }}
    >
      <div className="diary-list__cal-wrap">
        {coachVisible && (
          <CoachBubble
            className="diary-list__cal-coach"
            arrow="bottom-center"
            onDismiss={dismissCoach}
          >
            <p>
              <span className="coach-bubble__line">{t('diary.coach.writeDay')}</span>
              <span className="coach-bubble__line">{t('diary.coach.writeDayHint')}</span>
            </p>
          </CoachBubble>
        )}
        <MoodCalendar
          entries={entries}
          viewYear={viewYear}
          viewMonth={viewMonth}
          onViewChange={onViewChange}
          selectedDate={selectedDate}
          highlightDate={highlightDate}
          onSelectDate={handleCalendarDate}
          hideHeader
          coachDate={coachVisible ? todayStr : null}
        />
      </div>

      {entries.length === 0 ? (
        <div className="diary-list__empty-copy">
          <p>{t('diary.empty.line2')}</p>
        </div>
      ) : (
        <section ref={sectionRef} className="diary-list__section">
          <h2 className="diary-list__heading">{t('diary.list.monthTitle', { month: monthLabel })}</h2>
          {monthEntries.length === 0 ? (
            <p className="diary-list__month-empty">{t('diary.list.emptyMonth')}</p>
          ) : (
            <>
              <div className="diary-list__rows">
                {visibleEntries.map((entry) => (
                  <DiaryListRow key={entry.id} entry={entry} onClick={() => onSelect(entry.id)} />
                ))}
              </div>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="diary-list__more"
                  onClick={expanded ? handleCollapse : () => setExpanded(true)}
                  aria-expanded={expanded}
                >
                  {expanded
                    ? t('diary.list.collapse')
                    : t('diary.list.showMore', { count: hiddenCount })}
                  <span className="diary-list__more-chevron" aria-hidden>
                    {expanded ? '∧' : '∨'}
                  </span>
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default DiaryListPage;
