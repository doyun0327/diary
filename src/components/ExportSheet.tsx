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

interface ExportSheetProps {
  entries: DiaryEntry[];
  onClose: () => void;
  onOpenBook: (filtered: DiaryEntry[], range: { start: string; end: string }) => void;
}

function ExportSheet({ entries, onClose, onOpenBook }: ExportSheetProps) {
  const { t } = useTranslation();
  const initialYm = yearMonthFromYmd(thisMonthRange().start);
  const [year, setYear] = useState(initialYm.year);
  const [month, setMonth] = useState(initialYm.month);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const start = monthStartYmd(year, month);
  const end = monthEndYmd(year, month);

  const applyPreset = (next: Preset) => {
    if (next === 'thisMonth') {
      const ym = yearMonthFromYmd(thisMonthRange().start);
      setYear(ym.year);
      setMonth(ym.month);
      setChoiceOpen(false);
      return;
    }
    if (next === 'lastMonth') {
      const ym = yearMonthFromYmd(lastMonthRange().start);
      setYear(ym.year);
      setMonth(ym.month);
      setChoiceOpen(false);
      return;
    }
    setChoiceOpen(false);
    setPickerOpen(true);
  };

  const filtered = useMemo(
    () => filterEntriesByDateRange(entries, start, end),
    [entries, start, end],
  );

  const handleBook = () => {
    if (filtered.length === 0) return;
    onOpenBook(filtered, { start, end });
  };

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

        <p className="export-sheet__period-label">{t('export.month')}</p>
        <div className="export-sheet__range" role="group" aria-label={t('export.month')}>
          <button
            type="button"
            className="export-sheet__box export-sheet__box--single"
            aria-label={t('export.month')}
            aria-expanded={choiceOpen}
            onClick={() => setChoiceOpen(true)}
          >
            {formatYearMonth(year, month)}
          </button>
        </div>

        <p className="export-sheet__hint">{t('export.monthHint')}</p>

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

      {choiceOpen && (
        <div className="export-sheet__choice">
          <button
            type="button"
            className="export-sheet__choice-backdrop"
            aria-label={t('common.close')}
            onClick={() => setChoiceOpen(false)}
          />
          <div
            className="export-sheet__choice-panel"
            role="dialog"
            aria-label={t('export.presetsAria')}
          >
            <button type="button" onClick={() => applyPreset('thisMonth')}>
              {t('export.thisMonth')}
            </button>
            <button type="button" onClick={() => applyPreset('lastMonth')}>
              {t('export.lastMonth')}
            </button>
            <button type="button" onClick={() => applyPreset('custom')}>
              {t('export.custom')}
            </button>
          </div>
        </div>
      )}

      {pickerOpen && (
        <MonthYearPicker
          year={year}
          month={month}
          onClose={() => setPickerOpen(false)}
          onSelect={(nextYear, nextMonth) => {
            setYear(nextYear);
            setMonth(nextMonth);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default ExportSheet;
