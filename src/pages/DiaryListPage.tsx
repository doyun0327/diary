import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import MoodCalendar from '../components/MoodCalendar';
import DiaryListRow from '../components/DiaryListRow';
import { formatYearMonth } from '../utils/date';
import './DiaryListPage.css';

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

  const monthEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date.startsWith(monthPrefix))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, monthPrefix],
  );

  const handleCalendarDate = (date: string) => {
    const entry = entries.find((e) => e.date === date);
    if (entry) onSelect(entry.id);
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
        <section className="diary-list__section">
          <h2 className="diary-list__heading">{t('diary.list.monthTitle', { month: monthLabel })}</h2>
          {monthEntries.length === 0 ? (
            <p className="diary-list__month-empty">{t('diary.list.emptyMonth')}</p>
          ) : (
            <div className="diary-list__rows">
              {monthEntries.map((entry) => (
                <DiaryListRow key={entry.id} entry={entry} onClick={() => onSelect(entry.id)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default DiaryListPage;
