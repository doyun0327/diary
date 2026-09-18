import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SubscriptionBenefitsSwipe.css';

const IMAGES = [2, 6, 7, 8] as const;

interface SubscriptionBenefitsSwipeProps {
  /** 냥 티켓 등 시트용 — 높이 축소 */
  compact?: boolean;
}

/** 구독 모달 — Pro 소개 이미지 가로 스와이프 */
export default function SubscriptionBenefitsSwipe({
  compact = false,
}: SubscriptionBenefitsSwipeProps = {}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(IMAGES.length - 1, next)));
  };

  const onSwipeEnd = (x: number, y: number) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    // 세로 스크롤 중이면 슬라이드 넘기지 않음 (시트 스크롤과 충돌 방지)
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
    if (dx < 0) go(index + 1);
    else go(index - 1);
  };

  return (
    <div className={`sub-benefits${compact ? ' sub-benefits--compact' : ''}`}>
      <div
        className="sub-benefits__viewport"
        onTouchStart={(e) => {
          const t0 = e.changedTouches[0];
          if (!t0) return;
          startRef.current = { x: t0.clientX, y: t0.clientY };
        }}
        onTouchEnd={(e) => {
          const t0 = e.changedTouches[0];
          if (!t0) return;
          onSwipeEnd(t0.clientX, t0.clientY);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          startRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') return;
          onSwipeEnd(e.clientX, e.clientY);
        }}
      >
        <div
          className="sub-benefits__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {IMAGES.map((n, i) => (
            <div key={n} className="sub-benefits__slide" aria-hidden={i !== index}>
              <img
                className="sub-benefits__image"
                src={`/intro/${n}.png`}
                alt={t('appIntro.sample', { n })}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="sub-benefits__dots" role="tablist" aria-label={t('appIntro.aria')}>
        {IMAGES.map((n, i) => (
          <button
            key={n}
            type="button"
            className={`sub-benefits__dot${i === index ? ' is-active' : ''}`}
            onClick={() => go(i)}
            aria-label={t('appIntro.sample', { n })}
            aria-current={i === index ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
