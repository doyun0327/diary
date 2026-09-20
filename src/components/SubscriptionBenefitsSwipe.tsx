import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SubscriptionBenefitsSwipe.css';

/** public/intro — 구독 혜택 이미지 */
const IMAGES = [
  { id: 'draw50', file: '50장.png', labelKey: 'nyangTicket.benefitDraw50' },
  { id: 'pdf', file: 'pdf저장.png', labelKey: 'nyangTicket.benefitPdf' },
  { id: 'search', file: '검색.png', labelKey: 'nyangTicket.benefitSearch' },
  { id: 'noAds', file: '광고제거.png', labelKey: 'nyangTicket.benefitNoAds' },
] as const;

function introSrc(file: string): string {
  return `/intro/${encodeURIComponent(file)}`;
}

interface SubscriptionBenefitsSwipeProps {
  /** 냥 티켓 등 시트용 — 썸네일 조금 더 작게 */
  compact?: boolean;
}

/** 구독 혜택 — 썸네일 스크롤 + 탭 시 확대 */
export default function SubscriptionBenefitsSwipe({
  compact = false,
}: SubscriptionBenefitsSwipeProps = {}) {
  const { t } = useTranslation();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (previewIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null);
      if (e.key === 'ArrowRight') {
        setPreviewIndex((i) =>
          i == null ? i : Math.min(IMAGES.length - 1, i + 1),
        );
      }
      if (e.key === 'ArrowLeft') {
        setPreviewIndex((i) => (i == null ? i : Math.max(0, i - 1)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIndex]);

  const goPreview = (next: number) => {
    setPreviewIndex(Math.max(0, Math.min(IMAGES.length - 1, next)));
  };

  const onPreviewSwipeStart = (x: number, y: number) => {
    swipeStartRef.current = { x, y };
  };

  const onPreviewSwipeEnd = (x: number, y: number) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (start == null || previewIndex == null) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
    if (dx < 0) goPreview(previewIndex + 1);
    else goPreview(previewIndex - 1);
  };

  const preview = previewIndex != null ? IMAGES[previewIndex] : null;

  return (
    <div className={`sub-benefits${compact ? ' sub-benefits--compact' : ''}`}>
      <ul className="sub-benefits__grid" role="list">
        {IMAGES.map((item, i) => (
          <li key={item.id} className="sub-benefits__cell">
            <button
              type="button"
              className="sub-benefits__thumb"
              onClick={() => setPreviewIndex(i)}
              aria-label={t(item.labelKey)}
            >
              <img
                className="sub-benefits__thumb-img"
                src={introSrc(item.file)}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            </button>
          </li>
        ))}
      </ul>

      {preview && previewIndex != null ? (
        <div className="sub-benefits__lightbox" role="dialog" aria-modal="true">
          <button
            type="button"
            className="sub-benefits__lightbox-backdrop"
            aria-label={t('common.close')}
            onClick={() => setPreviewIndex(null)}
          />
          <div className="sub-benefits__lightbox-panel">
            <div
              className="sub-benefits__lightbox-stage"
              onTouchStart={(e) => {
                const t0 = e.changedTouches[0];
                if (!t0) return;
                onPreviewSwipeStart(t0.clientX, t0.clientY);
              }}
              onTouchEnd={(e) => {
                const t0 = e.changedTouches[0];
                if (!t0) return;
                onPreviewSwipeEnd(t0.clientX, t0.clientY);
              }}
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') return;
                onPreviewSwipeStart(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                if (e.pointerType === 'touch') return;
                onPreviewSwipeEnd(e.clientX, e.clientY);
              }}
            >
              <img
                className="sub-benefits__lightbox-img"
                src={introSrc(preview.file)}
                alt={t(preview.labelKey)}
                draggable={false}
              />
            </div>
            <div className="sub-benefits__lightbox-nav" aria-hidden>
              <button
                type="button"
                className="sub-benefits__lightbox-nav-btn"
                disabled={previewIndex <= 0}
                onClick={() => goPreview(previewIndex - 1)}
              >
                ‹
              </button>
              <span className="sub-benefits__lightbox-count">
                {previewIndex + 1} / {IMAGES.length}
              </span>
              <button
                type="button"
                className="sub-benefits__lightbox-nav-btn"
                disabled={previewIndex >= IMAGES.length - 1}
                onClick={() => goPreview(previewIndex + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
