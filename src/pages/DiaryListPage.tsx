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

  const hiddenCount = Math.max(0, monthEntries.length - PREVIEW_LIMIT);
  const visibleEntries = expanded ? monthEntries : monthEntries.slice(0, PREVIEW_LIMIT);

  const dismissCoach = () => {
    markTodayCellCoachSeen();
    setShowCoach(false);
  };

  const handleCalendarDate = (date: string) => {
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
    <div className={`diary-list${entries.length === 0 ? ' diary-list--empty' : ''}`}>
      <div className="diary-list__cal-wrap">
        {coachVisible && (
          <CoachBubble
            className="diary-list__cal-coach"
            arrow="bottom-center"
            onDismiss={dismissCoach}
          >
            <p>
              {t('diary.coach.writeDay')}
              <br />
              {t('diary.coach.writeDayHint')}
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
