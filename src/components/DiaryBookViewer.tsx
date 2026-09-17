import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLottie } from 'lottie-react';
import type { DiaryEntry } from '../types/diary';
import { exportPdfFilename } from '../utils/dateRange';
import {
  BOOK_PREVIEW_CAPTURE,
  BOOK_PREVIEW_SIZE,
  buildStreamingDiaryPdf,
  drainBookCaptureQueue,
  renderCoverBookPage,
  renderEntryBookPage,
  revokeBookPage,
  type BookPage,
} from '../utils/diaryBook';
import { downloadToDevice } from '../utils/saveBlob';
import BackIcon from './BackIcon';
import './DiaryBookViewer.css';

const PDF_LOTTIE_URLS = ['/lottie/ai-loading.json', '/lottie/ai-loading-cat.json'] as const;

function pickRandomLottie(
  pool: object[],
  exclude: object | null = null,
): object | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0] ?? null;
  const candidates =
    exclude != null ? pool.filter((item) => item !== exclude) : pool;
  const list = candidates.length > 0 ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)] ?? null;
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
  const [pdfProgress, setPdfProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [pdfLottiePool, setPdfLottiePool] = useState<object[]>([]);
  const [pdfLottie, setPdfLottie] = useState<object | null>(null);
  const [pdfLottieKey, setPdfLottieKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const pagesRef = useRef(pages);
  const jobsRef = useRef(new Map<number, Promise<void>>());
  const genRef = useRef(0);
  const flipLockRef = useRef(false);
  /** 현재 인덱스 근처만 유지 (멀리 있는 페이지 blob 해제) */
  const KEEP_RADIUS = 2;

  pagesRef.current = pages;

  const pruneDistantPages = useCallback((center: number) => {
    setPages((prev) => {
      let changed = false;
      const next = [...prev];
      for (let i = 1; i < next.length; i += 1) {
        if (!next[i]) continue;
        if (Math.abs(i - center) <= KEEP_RADIUS) continue;
        revokeBookPage(next[i]!);
        next[i] = null;
        pagesRef.current[i] = null;
        jobsRef.current.delete(i);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const ensurePage = useCallback(
    (i: number) => {
      if (i <= 0 || i >= total) return Promise.resolve();
      if (pagesRef.current[i]) return Promise.resolve();
      const existing = jobsRef.current.get(i);
      if (existing) return existing;
      const gen = genRef.current;

      const job = (async () => {
        try {
          const page = await renderEntryBookPage(
            sorted[i - 1],
            BOOK_PREVIEW_CAPTURE,
            BOOK_PREVIEW_SIZE,
          );
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
        } finally {
          jobsRef.current.delete(i);
        }
      })();

      jobsRef.current.set(i, job);
      return job;
    },
    [sorted, t, total],
  );

  const ensureCover = useCallback(() => {
    if (pagesRef.current[0]) return Promise.resolve();
    const existing = jobsRef.current.get(0);
    if (existing) return existing;
    const gen = genRef.current;

    const job = (async () => {
      try {
        if (sorted.length > 0) {
          await ensurePage(1);
        }
        const page = await renderCoverBookPage(sorted, {
          avatarUrl,
          rangeStart,
          rangeEnd,
          slot: pagesRef.current[1]?.slot,
        });
        if (gen !== genRef.current) {
          revokeBookPage(page);
          return;
        }
        pagesRef.current[0] = page;
        setPages((prev) => {
          const next = [...prev];
          next[0] = page;
          return next;
        });
      } catch (err) {
        if (gen === genRef.current) {
          setError(err instanceof Error ? err.message : t('book.err.build'));
        }
      } finally {
        jobsRef.current.delete(0);
      }
    })();

    jobsRef.current.set(0, job);
    return job;
  }, [avatarUrl, ensurePage, rangeEnd, rangeStart, sorted, t]);

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
      PDF_LOTTIE_URLS.map(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          return (await res.json()) as object;
        } catch {
          return null;
        }
      }),
    )
      .then((results) => {
        if (!cancelled) {
          setPdfLottiePool(
            results.filter((item): item is object => item != null),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setPdfLottiePool([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (downloading) return;
    void ensureCover();
    if (index > 0) {
      void ensurePage(index);
    } else {
      void ensurePage(1);
    }
    // 앞뒤 미리 준비
    if (index + 1 < total) void ensurePage(index + 1);
    if (index > 1) void ensurePage(index - 1);
    pruneDistantPages(index);
  }, [downloading, ensureCover, ensurePage, index, pruneDistantPages, total]);

  const isCover = index === 0;
  const cover = pages[0];
  const current = isCover ? cover : pages[index];
  const busy = !current;
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
    if (flip !== 'none' || busy || flipLockRef.current) return;
    if (dir === 'next' && !canNext) return;
    if (dir === 'prev' && !canPrev) return;
    const nextIndex = dir === 'next' ? index + 1 : index - 1;

    flipLockRef.current = true;
    void (async () => {
      try {
        if (nextIndex === 0) {
          await ensureCover();
          if (!pagesRef.current[0]) return;
        } else {
          await ensurePage(nextIndex);
          if (!pagesRef.current[nextIndex]) return;
        }
        setFlip(dir);
      } finally {
        flipLockRef.current = false;
      }
    })();
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
    const diaryTotal = sorted.length;
    setPdfProgress({ current: 0, total: diaryTotal });
    setPdfLottie((prev) => pickRandomLottie(pdfLottiePool, prev));
    setPdfLottieKey((key) => key + 1);
    setError(null);

    try {
      // 미리보기 페이지·캡처를 먼저 비워 PDF와 메모리가 겹치지 않게
      genRef.current += 1;
      jobsRef.current.clear();
      pagesRef.current.forEach((page) => {
        if (page) revokeBookPage(page);
      });
      pagesRef.current = Array.from({ length: total }, () => null);
      setPages(Array.from({ length: total }, () => null));
      await drainBookCaptureQueue();

      const blob = await buildStreamingDiaryPdf(sorted, {
        avatarUrl,
        rangeStart,
        rangeEnd,
        onProgress: (current, progressTotal) => {
          setPdfProgress({ current, total: progressTotal });
        },
      });
      await downloadToDevice(blob, pdfName);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('book.err.build'));
    } finally {
      setDownloading(false);
      setPdfProgress(null);
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
            {current ? (
              <div
                className={`${pageClass}${isCover ? ' diary-book__page--cover' : ''}`}
                onAnimationEnd={onFlipEnd}
              >
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
          <p className="diary-book__pdf-overlay-text">
            {pdfProgress
              ? t('book.savingProgress', {
                  current: pdfProgress.current,
                  total: pdfProgress.total,
                })
              : t('book.saving')}
          </p>
        </div>
      )}
    </div>
  );
}

export default DiaryBookViewer;
