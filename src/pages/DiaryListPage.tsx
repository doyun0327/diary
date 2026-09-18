import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import MoodCalendar from '../components/MoodCalendar';
import DiaryListRow from '../components/DiaryListRow';
import CoachBubble from '../components/CoachBubble';
import {
  isWriteFabCoachSeen,
  markWriteFabCoachSeen,
} from '../utils/onboarding';
import { formatYearMonth } from '../utils/date';
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
    () => entries.length === 0 && !isWriteFabCoachSeen(),
  );

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
    if (entries.length > 0) setShowCoach(false);
  }, [entries.length]);

  const hiddenCount = Math.max(0, monthEntries.length - PREVIEW_LIMIT);
  const visibleEntries = expanded ? monthEntries : monthEntries.slice(0, PREVIEW_LIMIT);

  const dismissCoach = () => {
    markWriteFabCoachSeen();
    setShowCoach(false);
  };

  const handleCalendarDate = (date: string) => {
    onSelectDate?.(date);
    const entry = entries.find((e) => e.date === date);
    if (entry) {
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
  const coachVisible = showCoach && entries.length === 0;

  return (
    <div className={`diary-list${entries.length === 0 ? ' diary-list--empty' : ''}`}>
      <div className="diary-list__cal-wrap">
        {coachVisible && (
          <CoachBubble
            className="diary-list__cal-coach"
            arrow="bottom-center"
            onDismiss={dismissCoach}
          >
            <p>{t('diary.coach.writeDay')}</p>
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
