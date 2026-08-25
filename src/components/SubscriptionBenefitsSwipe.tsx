import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SubscriptionBenefitsSwipe.css';

const IMAGES = [2, 6, 7, 8] as const;

/** 구독 모달 — Pro 소개 이미지 가로 스와이프 */
export default function SubscriptionBenefitsSwipe() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(IMAGES.length - 1, next)));
  };

  return (
    <div className="sub-benefits">
      <div
        className="sub-benefits__viewport"
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
          touchX.current = null;
          if (dx < -40) go(index + 1);
          if (dx > 40) go(index - 1);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          touchX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') return;
          if (touchX.current == null) return;
          const dx = e.clientX - touchX.current;
          touchX.current = null;
          if (dx < -40) go(index + 1);
          if (dx > 40) go(index - 1);
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
