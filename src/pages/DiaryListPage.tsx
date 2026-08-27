import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import MoodCalendar from '../components/MoodCalendar';
import DiaryListRow from '../components/DiaryListRow';
import { formatYearMonth } from '../utils/date';
import './DiaryListPage.css';

const PREVIEW_LIMIT = 3;

interface DiaryListPageProps {
  entries: DiaryEntry[];
  onSelect: (id: string) => void;
  viewYear: number;
  viewMonth: number;
  onViewChange: (year: number, month: number) => void;
}

function DiaryListPage({
  entries,
  onSelect,
  viewYear,
  viewMonth,
  onViewChange,
}: DiaryListPageProps) {
  const { t } = useTranslation();
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const sectionRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);

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

  const hiddenCount = Math.max(0, monthEntries.length - PREVIEW_LIMIT);
  const visibleEntries = expanded ? monthEntries : monthEntries.slice(0, PREVIEW_LIMIT);

  const handleCalendarDate = (date: string) => {
    const entry = entries.find((e) => e.date === date);
    if (entry) onSelect(entry.id);
  };

  const handleCollapse = () => {
    setExpanded(false);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const monthLabel = formatYearMonth(monthPrefix);

  return (
    <div className={`diary-list${entries.length === 0 ? ' diary-list--empty' : ''}`}>
      <MoodCalendar
        entries={entries}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onViewChange={onViewChange}
        onSelectDate={handleCalendarDate}
        hideHeader
      />

      {entries.length === 0 ? (
        <div className="diary-list__empty-copy">
          <p>{t('diary.empty.line1')}</p>
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
