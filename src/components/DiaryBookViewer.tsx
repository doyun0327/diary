import { useEffect, useMemo, useRef, useState } from 'react';
import type { DiaryEntry } from '../types/diary';
import {
  buildBookPages,
  downloadDiaryBookPdf,
  type BookPage,
} from '../utils/diaryBook';
import './DiaryBookViewer.css';

interface DiaryBookViewerProps {
  entries: DiaryEntry[];
  onClose: () => void;
}

function DiaryBookViewer({ entries, onClose }: DiaryBookViewerProps) {
  const [pages, setPages] = useState<BookPage[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState<'none' | 'next' | 'prev'>('none');
  const [busy, setBusy] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    void buildBookPages(entries)
      .then((built) => {
        if (!cancelled) {
          setPages(built);
          setIndex(0);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '일기장을 만들지 못했어요');
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  const total = pages?.length ?? 0;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  const go = (dir: 'next' | 'prev') => {
    if (flip !== 'none' || !pages) return;
    if (dir === 'next' && !canNext) return;
    if (dir === 'prev' && !canPrev) return;
    setFlip(dir);
  };

  const onFlipEnd = () => {
    if (flip === 'next') setIndex((i) => i + 1);
    if (flip === 'prev') setIndex((i) => i - 1);
    setFlip('none');
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const name =
        entries.length === 1
          ? `diary_${entries[0].date}.pdf`
          : 'diary.pdf';
      await downloadDiaryBookPdf(entries, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 저장에 실패했어요');
    } finally {
      setDownloading(false);
    }
  };

  const subtitle = useMemo(() => {
    if (!pages) return '';
    return `${index + 1} / ${pages.length}`;
  }, [index, pages]);

  return (
    <div className="diary-book" role="dialog" aria-label="일기장 보기">
      <div className="diary-book__backdrop" onClick={onClose} />
      <div className="diary-book__panel">
        <header className="diary-book__head">
          <button type="button" onClick={onClose}>
            닫기
          </button>
          <span>{subtitle}</span>
          <button type="button" onClick={handleDownload} disabled={busy || downloading || !pages}>
            {downloading ? '저장 중…' : 'PDF'}
          </button>
        </header>

        {busy && <p className="diary-book__status">일기장을 만드는 중…</p>}
        {error && <p className="diary-book__error">{error}</p>}

        {pages && !busy && (
          <div
            className="diary-book__stage"
            onTouchStart={(e) => {
              touchX.current = e.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchX.current == null) return;
              const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
              touchX.current = null;
              if (dx < -40) go('next');
              if (dx > 40) go('prev');
            }}
          >
            <button
              type="button"
              className="diary-book__nav diary-book__nav--prev"
              onClick={() => go('prev')}
              disabled={!canPrev || flip !== 'none'}
              aria-label="이전 페이지"
            >
              ‹
            </button>

            <div className="diary-book__viewport">
              <div
                className={`diary-book__page ${flip === 'next' ? 'is-flip-next' : ''} ${flip === 'prev' ? 'is-flip-prev' : ''}`}
                onAnimationEnd={onFlipEnd}
              >
                <img src={pages[index].dataUrl} alt={pages[index].label} draggable={false} />
              </div>
            </div>

            <button
              type="button"
              className="diary-book__nav diary-book__nav--next"
              onClick={() => go('next')}
              disabled={!canNext || flip !== 'none'}
              aria-label="다음 페이지"
            >
              ›
            </button>
          </div>
        )}

        <p className="diary-book__hint">좌우로 밀거나 화살표로 넘겨 보세요</p>
      </div>
    </div>
  );
}

export default DiaryBookViewer;
