import { useMemo, useState } from 'react';
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
      setError(err instanceof Error ? err.message : 'PDF 저장에 실패했어요');
    } finally {
      setDownloading(false);
    }
  };

  const handleBook = () => {
    if (filtered.length === 0) return;
    onOpenBook(filtered);
  };

  return (
    <div className="export-sheet" role="dialog" aria-label="내보내기">
      <div className="export-sheet__backdrop" onClick={onClose} />
      <div className="export-sheet__panel">
        <header className="export-sheet__head">
          <h2>내보내기</h2>
          <button type="button" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </header>

        <p className="export-sheet__label">기간</p>
        <div className="export-sheet__presets" role="group" aria-label="기간 프리셋">
          <button
            type="button"
            className={preset === 'thisMonth' ? 'is-active' : ''}
            onClick={() => applyPreset('thisMonth')}
          >
            이번 달
          </button>
          <button
            type="button"
            className={preset === 'lastMonth' ? 'is-active' : ''}
            onClick={() => applyPreset('lastMonth')}
          >
            지난달
          </button>
          <button
            type="button"
            className={preset === 'custom' ? 'is-active' : ''}
            onClick={() => applyPreset('custom')}
          >
            직접 선택
          </button>
        </div>

        <div className="export-sheet__dates">
          <label>
            시작
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
            끝
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
            ? `${filtered.length}건의 일기`
            : '이 기간에 작성한 일기가 없어요'}
        </p>
        {error && <p className="export-sheet__error">{error}</p>}

        <div className="export-sheet__actions">
          <button type="button" disabled={!canExport} onClick={handlePdf}>
            {downloading ? '저장 중…' : 'PDF 저장'}
          </button>
          <button type="button" className="primary" disabled={!canExport} onClick={handleBook}>
            일기장으로 보기
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportSheet;
