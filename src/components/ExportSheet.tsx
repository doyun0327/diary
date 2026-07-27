import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import {
  exportPdfFilename,
  filterEntriesByDateRange,
  lastMonthRange,
  thisMonthRange,
} from '../utils/dateRange';
import { downloadDiaryBookPdf } from '../utils/diaryBook';
import './ExportSheet.css';

type Preset = 'thisMonth' | 'lastMonth' | 'custom';

interface ExportSheetProps {
  entries: DiaryEntry[];
  onClose: () => void;
  onOpenBook: (filtered: DiaryEntry[]) => void;
}

function ExportSheet({ entries, onClose, onOpenBook }: ExportSheetProps) {
  const { t } = useTranslation();
  const initial = thisMonthRange();
  const [preset, setPreset] = useState<Preset>('thisMonth');
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (next: Preset) => {
    setPreset(next);
    setError(null);
    if (next === 'thisMonth') {
      const r = thisMonthRange();
      setStart(r.start);
      setEnd(r.end);
    } else if (next === 'lastMonth') {
      const r = lastMonthRange();
      setStart(r.start);
      setEnd(r.end);
    }
  };

  const filtered = useMemo(
    () => filterEntriesByDateRange(entries, start, end),
    [entries, start, end],
  );

  const canExport = filtered.length > 0 && !downloading;

  const handlePdf = async () => {
    if (!canExport) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadDiaryBookPdf(filtered, exportPdfFilename(start, end));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('export.err.pdf'));
    } finally {
      setDownloading(false);
    }
  };

  const handleBook = () => {
    if (filtered.length === 0) return;
    onOpenBook(filtered);
  };

  return (
    <div className="export-sheet" role="dialog" aria-label={t('export.aria')}>
      <div className="export-sheet__backdrop" onClick={onClose} />
      <div className="export-sheet__panel">
        <header className="export-sheet__head">
          <h2>{t('export.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            {t('common.close')}
          </button>
        </header>

        <p className="export-sheet__label">{t('export.period')}</p>
        <div className="export-sheet__presets" role="group" aria-label={t('export.presetsAria')}>
          <button
            type="button"
            className={preset === 'thisMonth' ? 'is-active' : ''}
            onClick={() => applyPreset('thisMonth')}
          >
            {t('export.thisMonth')}
          </button>
          <button
            type="button"
            className={preset === 'lastMonth' ? 'is-active' : ''}
            onClick={() => applyPreset('lastMonth')}
          >
            {t('export.lastMonth')}
          </button>
          <button
            type="button"
            className={preset === 'custom' ? 'is-active' : ''}
            onClick={() => applyPreset('custom')}
          >
            {t('export.custom')}
          </button>
        </div>

        <div className="export-sheet__dates">
          <label>
            {t('export.start')}
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setPreset('custom');
                setStart(e.target.value);
              }}
            />
          </label>
          <label>
            {t('export.end')}
            <input
              type="date"
              value={end}
              onChange={(e) => {
                setPreset('custom');
                setEnd(e.target.value);
              }}
            />
          </label>
        </div>

        <p className="export-sheet__count">
          {filtered.length > 0
            ? t('export.count', { n: filtered.length })
            : t('export.empty')}
        </p>
        {error && <p className="export-sheet__error">{error}</p>}

        <div className="export-sheet__actions">
          <button type="button" disabled={!canExport} onClick={handlePdf}>
            {downloading ? t('export.saving') : t('export.pdf')}
          </button>
          <button type="button" className="primary" disabled={!canExport} onClick={handleBook}>
            {t('export.openBook')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportSheet;
