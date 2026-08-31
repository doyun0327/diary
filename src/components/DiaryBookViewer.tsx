import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLottie } from 'lottie-react';
import type { DiaryEntry } from '../types/diary';
import { exportPdfFilename } from '../utils/dateRange';
import {
  buildPdfFromBookPages,
  renderCoverBookPage,
  renderEntryBookPage,
  revokeBookPage,
  type BookPage,
} from '../utils/diaryBook';
import { downloadToDevice } from '../utils/saveBlob';
import BackIcon from './BackIcon';
import './DiaryBookViewer.css';

const PDF_LOTTIE_URLS = ['/lottie/ai-loading.json', '/lottie/ai-loading-cat.json'] as const;

function pickRandomLottie(pool: object[]): object | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function PdfLoadingLottie({ animationData }: { animationData: object }) {
  const { View } = useLottie({
    animationData,
    loop: true,
    autoplay: true,
  });
  return <div className="diary-book__pdf-lottie">{View}</div>;
}

interface DiaryBookViewerProps {
  entries: DiaryEntry[];
  rangeStart?: string;
  rangeEnd?: string;
  avatarUrl?: string | null;
  canDownloadPdf?: boolean;
  onRequirePremium?: () => void;
  onClose: () => void;
}

function coverDateLabel(entries: DiaryEntry[], rangeStart?: string, rangeEnd?: string): string {
  const from = rangeStart || entries[0]?.date || '';
  const to = rangeEnd || entries[entries.length - 1]?.date || from;
  if (!from) return '';
  return `${from} ~ ${to}`;
}

function BookCover({
  entries,
  avatarUrl,
  rangeStart,
  rangeEnd,
}: {
  entries: DiaryEntry[];
  avatarUrl?: string | null;
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const range = coverDateLabel(entries, rangeStart, rangeEnd);

  return (
    <div className="diary-book__cover">
      <p className="diary-book__cover-brand">PageBy</p>
      {avatarUrl ? (
        <img className="diary-book__cover-avatar" src={avatarUrl} alt="" />
      ) : (
        <span className="diary-book__cover-avatar diary-book__cover-avatar--empty" />
      )}
      {range ? <p className="diary-book__cover-range">{range}</p> : null}
    </div>
  );
}

function DiaryBookViewer({
  entries,
  rangeStart,
  rangeEnd,
  avatarUrl = null,
  canDownloadPdf = true,
  onRequirePremium,
  onClose,
}: DiaryBookViewerProps) {
  const { t } = useTranslation();
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );
  const total = sorted.length + 1;
  const [pages, setPages] = useState<(BookPage | null)[]>(() =>
    Array.from({ length: total }, () => null),
  );
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState<'none' | 'next' | 'prev'>('none');
  const [downloading, setDownloading] = useState(false);
  const [pdfLottiePool, setPdfLottiePool] = useState<object[]>([]);
  const [pdfLottie, setPdfLottie] = useState<object | null>(null);
  const [pdfLottieKey, setPdfLottieKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const pagesRef = useRef(pages);
  const jobsRef = useRef(new Map<number, Promise<void>>());
  const genRef = useRef(0);

  pagesRef.current = pages;

  const ensurePage = useCallback(
    (i: number) => {
      if (i <= 0 || i >= total) return Promise.resolve();
      if (pagesRef.current[i]) return Promise.resolve();
      const existing = jobsRef.current.get(i);
      if (existing) return existing;
      const gen = genRef.current;

      const job = (async () => {
        try {
          const page = await renderEntryBookPage(sorted[i - 1]);
          if (gen !== genRef.current) {
            revokeBookPage(page);
            return;
          }
          pagesRef.current[i] = page;
          setPages((prev) => {
            const next = [...prev];
            next[i] = page;
            return next;
          });
        } catch (err) {
          if (gen === genRef.current) {
            setError(err instanceof Error ? err.message : t('book.err.build'));
          }
        }
      })();

      jobsRef.current.set(i, job);
      return job;
    },
    [sorted, t, total],
  );

  useEffect(() => {
    genRef.current += 1;
    setPages(Array.from({ length: total }, () => null));
    setIndex(0);
    setError(null);
    jobsRef.current.clear();
    return () => {
      genRef.current += 1;
      pagesRef.current.forEach((page) => {
        if (page) revokeBookPage(page);
      });
    };
  }, [sorted, total]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      PDF_LOTTIE_URLS.map((url) => fetch(url).then((res) => res.json() as Promise<object>)),
    )
      .then((pool) => {
        if (!cancelled) setPdfLottiePool(pool);
      })
      .catch(() => {
        if (!cancelled) setPdfLottiePool([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void ensurePage(1);
    if (index > 0) void ensurePage(index);
  }, [ensurePage, index]);

  const isCover = index === 0;
  const current = isCover ? null : pages[index];
  const busy = !isCover && !current;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  const pdfName = useMemo(() => {
    if (rangeStart && rangeEnd) return exportPdfFilename(rangeStart, rangeEnd);
    if (entries.length === 1) {
      const d = entries[0].date;
      return exportPdfFilename(d, d);
    }
    const dates = entries.map((e) => e.date).sort();
    const from = dates[0] ?? rangeStart ?? '';
    const to = dates[dates.length - 1] ?? rangeEnd ?? from;
    return exportPdfFilename(from, to);
  }, [entries, rangeStart, rangeEnd]);

  const go = (dir: 'next' | 'prev') => {
    if (flip !== 'none' || busy) return;
    if (dir === 'next' && !canNext) return;
    if (dir === 'prev' && !canPrev) return;
    const nextIndex = dir === 'next' ? index + 1 : index - 1;
    if (nextIndex > 0) void ensurePage(nextIndex);
    setFlip(dir);
  };

  const onFlipEnd = () => {
    if (flip === 'next') setIndex((i) => i + 1);
    if (flip === 'prev') setIndex((i) => i - 1);
    setFlip('none');
  };

  const handleDownload = async () => {
    if (downloading) return;
    if (!canDownloadPdf) {
      onRequirePremium?.();
      return;
    }
    setDownloading(true);
    setPdfLottie(pickRandomLottie(pdfLottiePool));
    setPdfLottieKey((key) => key + 1);
    setError(null);
    try {
      await Promise.all(Array.from({ length: total }, (_, i) => ensurePage(i)));
      const cover = await renderCoverBookPage(sorted, {
        avatarUrl,
        rangeStart,
        rangeEnd,
      });
      const rest = pagesRef.current
        .map((p, i) => (i === 0 ? cover : p))
        .filter((p): p is BookPage => p != null);
      if (rest.length !== total) {
        revokeBookPage(cover);
        throw new Error(t('book.err.build'));
      }
      const blob = await buildPdfFromBookPages(rest);
      await downloadToDevice(blob, pdfName);
      revokeBookPage(cover);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('book.err.build'));
    } finally {
      setDownloading(false);
    }
  };

  const subtitle = `${index + 1} / ${total}`;
  const pageClass = `diary-book__page${flip === 'next' ? ' is-flip-next' : ''}${flip === 'prev' ? ' is-flip-prev' : ''}`;

  return (
    <div className="diary-book" role="dialog" aria-label={t('book.dialogAria')}>
      <div className="diary-book__backdrop" onClick={downloading ? undefined : onClose} />
      <div className="diary-book__panel">
        <header className="diary-book__head">
          <button
            type="button"
            className="diary-book__icon-btn diary-book__icon-btn--back"
            onClick={onClose}
            disabled={downloading}
            aria-label={t('common.close')}
          >
            <BackIcon size={22} strokeWidth={2.2} />
          </button>
          <span className="diary-book__title">{subtitle}</span>
          <button
            type="button"
            className="diary-book__icon-btn diary-book__icon-btn--end"
            onClick={() => void handleDownload()}
            disabled={downloading}
            aria-label={t('book.pdfAria')}
            title={t('book.pdfTitle')}
          >
            {downloading ? (
              '…'
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </button>
        </header>

        {error && <p className="diary-book__error">{error}</p>}

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
            disabled={!canPrev || flip !== 'none' || busy}
            aria-label={t('book.prevPage')}
          >
            ‹
          </button>

          <div className="diary-book__viewport">
            {isCover ? (
              <div className={`${pageClass} diary-book__page--cover`} onAnimationEnd={onFlipEnd}>
                <BookCover
                  entries={sorted}
                  avatarUrl={avatarUrl}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                />
              </div>
            ) : current ? (
              <div className={pageClass} onAnimationEnd={onFlipEnd}>
                <img src={current.blobUrl} alt={current.label} draggable={false} />
              </div>
            ) : (
              <div className="diary-book__status" role="status" aria-live="polite">
                <img
                  className="diary-book__status-img"
                  src="/brand/sketch-book-writing.gif"
                  alt=""
                  width={120}
                  height={120}
                  draggable={false}
                />
                <p className="diary-book__status-text">{t('book.building')}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="diary-book__nav diary-book__nav--next"
            onClick={() => go('next')}
            disabled={!canNext || flip !== 'none' || busy}
            aria-label={t('book.nextPage')}
          >
            ›
          </button>
        </div>

        <p className="diary-book__hint"></p>
      </div>
      {downloading && (
        <div className="diary-book__pdf-overlay" role="status" aria-live="polite">
          {pdfLottie ? (
            <PdfLoadingLottie key={pdfLottieKey} animationData={pdfLottie} />
          ) : null}
          <p className="diary-book__pdf-overlay-text">{t('book.saving')}</p>
        </div>
      )}
    </div>
  );
}

export default DiaryBookViewer;
