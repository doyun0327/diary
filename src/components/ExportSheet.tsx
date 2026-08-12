import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import {
  exportPdfFilename,
  filterEntriesByDateRange,
  lastMonthRange,
  thisMonthRange,
} from '../utils/dateRange';
import { buildDiaryBookPdf } from '../utils/diaryBook';
import {
  canSharePdfFile,
  isLikelyMobile,
  saveOrShareBlob,
  type SaveBlobResult,
} from '../utils/saveBlob';
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
  /** 모바일: PDF 생성 후 제스처가 끊기면 한 번 더 탭해서 공유/열기 */
  const [readyPdf, setReadyPdf] = useState<{ blob: Blob; filename: string } | null>(
    null,
  );

  const mobileShare = canSharePdfFile() || isLikelyMobile();

  const applyPreset = (next: Preset) => {
    setPreset(next);
    setError(null);
    setReadyPdf(null);
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

  const finishSave = (result: SaveBlobResult) => {
    if (result === 'cancelled') return;
    setReadyPdf(null);
  };

  const handlePdf = async () => {
    if (downloading) return;

    // 2단계: 이미 만들어진 PDF를 유저 제스처로 공유/열기
    if (readyPdf) {
      setDownloading(true);
      setError(null);
      try {
        const result = await saveOrShareBlob(readyPdf.blob, readyPdf.filename, {
          title: readyPdf.filename,
          text: t('export.shareText'),
        });
        finishSave(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('export.err.pdf'));
      } finally {
        setDownloading(false);
      }
      return;
    }

    if (!canExport) return;
    setDownloading(true);
    setError(null);
    try {
      const filename = exportPdfFilename(start, end);
      const blob = await buildDiaryBookPdf(filtered);

      if (mobileShare) {
        const result = await saveOrShareBlob(blob, filename, {
          title: filename,
          text: t('export.shareText'),
          shareOnly: true,
        });
        if (result === 'shared') {
          setReadyPdf(null);
          return;
        }
        if (result === 'cancelled') return;
        // 제스처 소실·공유 미지원 → 한 번 더 탭 유도
        setReadyPdf({ blob, filename });
        return;
      }

      const result = await saveOrShareBlob(blob, filename, {
        title: filename,
        text: t('export.shareText'),
      });
      finishSave(result);
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

  const pdfLabel = downloading
    ? t('export.saving')
    : readyPdf
      ? t('export.shareReady')
      : mobileShare
        ? t('export.sharePdf')
        : t('export.pdf');

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
                setReadyPdf(null);
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
                setReadyPdf(null);
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
        {readyPdf && !downloading && (
          <p className="export-sheet__hint">{t('export.shareHint')}</p>
        )}
        {error && <p className="export-sheet__error">{error}</p>}

        <div className="export-sheet__actions">
          <button
            type="button"
            className={readyPdf ? 'primary' : undefined}
            disabled={(!canExport && !readyPdf) || downloading}
            onClick={() => void handlePdf()}
          >
            {pdfLabel}
          </button>
          <button
            type="button"
            className={readyPdf ? undefined : 'primary'}
            disabled={!canExport}
            onClick={handleBook}
          >
            {t('export.openBook')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportSheet;
