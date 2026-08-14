import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import { formatYearMonth } from '../utils/date';
import {
  filterEntriesByDateRange,
  lastMonthRange,
  monthEndYmd,
  monthStartYmd,
  thisMonthRange,
  yearMonthFromYmd,
} from '../utils/dateRange';
import CloseIcon from './CloseIcon';
import MonthYearPicker from './MonthYearPicker';
import './ExportSheet.css';

type Preset = 'thisMonth' | 'lastMonth' | 'custom';
type MonthField = 'start' | 'end';

interface ExportSheetProps {
  entries: DiaryEntry[];
  onClose: () => void;
  onOpenBook: (filtered: DiaryEntry[], range: { start: string; end: string }) => void;
}

function ExportSheet({ entries, onClose, onOpenBook }: ExportSheetProps) {
  const { t } = useTranslation();
  const initial = thisMonthRange();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [choiceFor, setChoiceFor] = useState<MonthField | null>(null);
  const [picker, setPicker] = useState<MonthField | null>(null);

  const applyPreset = (next: Preset, field: MonthField) => {
    if (next === 'thisMonth') {
      const r = thisMonthRange();
      setStart(r.start);
      setEnd(r.end);
      setChoiceFor(null);
      return;
    }
    if (next === 'lastMonth') {
      const r = lastMonthRange();
      setStart(r.start);
      setEnd(r.end);
      setChoiceFor(null);
      return;
    }
    setChoiceFor(null);
    setPicker(field);
  };

  const filtered = useMemo(
    () => filterEntriesByDateRange(entries, start, end),
    [entries, start, end],
  );

  const handleBook = () => {
    if (filtered.length === 0) return;
    onOpenBook(filtered, { start, end });
  };

  const startYm = yearMonthFromYmd(start);
  const endYm = yearMonthFromYmd(end);

  return (
    <div className="export-sheet" role="dialog" aria-label={t('export.aria')}>
      <div className="export-sheet__backdrop" onClick={onClose} />
      <div className="export-sheet__panel">
        <header className="export-sheet__head">
          <h2>{t('export.title')}</h2>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        <p className="export-sheet__period-label">{t('export.period')}</p>
        <div className="export-sheet__range" role="group" aria-label={t('export.period')}>
          <button
            type="button"
            className="export-sheet__box"
            aria-label={t('export.start')}
            aria-expanded={choiceFor === 'start'}
            onClick={() => setChoiceFor('start')}
          >
            {formatYearMonth(startYm.year, startYm.month)}
          </button>
          <span className="export-sheet__tilde" aria-hidden>
            ~
          </span>
          <button
            type="button"
            className="export-sheet__box"
            aria-label={t('export.end')}
            aria-expanded={choiceFor === 'end'}
            onClick={() => setChoiceFor('end')}
          >
            {formatYearMonth(endYm.year, endYm.month)}
          </button>
        </div>

        <p className="export-sheet__count">
          {filtered.length > 0
            ? t('export.count', { n: filtered.length })
            : t('export.empty')}
        </p>

        <div className="export-sheet__actions">
          <button
            type="button"
            className="primary"
            disabled={filtered.length === 0}
            onClick={handleBook}
          >
            {t('export.openBook')}
          </button>
        </div>
      </div>

      {choiceFor && (
        <div className="export-sheet__choice">
          <button
            type="button"
            className="export-sheet__choice-backdrop"
            aria-label={t('common.close')}
            onClick={() => setChoiceFor(null)}
          />
          <div
            className="export-sheet__choice-panel"
            role="dialog"
            aria-label={t('export.presetsAria')}
          >
            <button type="button" onClick={() => applyPreset('thisMonth', choiceFor)}>
              {t('export.thisMonth')}
            </button>
            <button type="button" onClick={() => applyPreset('lastMonth', choiceFor)}>
              {t('export.lastMonth')}
            </button>
            <button type="button" onClick={() => applyPreset('custom', choiceFor)}>
              {t('export.custom')}
            </button>
          </div>
        </div>
      )}

      {picker && (
        <MonthYearPicker
          year={picker === 'start' ? startYm.year : endYm.year}
          month={picker === 'start' ? startYm.month : endYm.month}
          onClose={() => setPicker(null)}
          onSelect={(year, month) => {
            if (picker === 'start') setStart(monthStartYmd(year, month));
            else setEnd(monthEndYmd(year, month));
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

export default ExportSheet;
