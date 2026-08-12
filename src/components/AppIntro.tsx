import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './AppIntro.css';

const SLIDE_COUNT = 4;

type AppIntroProps = {
  onFinish: () => void;
};

/** 첫 실행 앱 소개 — 가로 슬라이드 (내용은 나중에 채움) */
export default function AppIntro({ onFinish }: AppIntroProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = (next: number) => {
    if (next >= SLIDE_COUNT) {
      onFinish();
      return;
    }
    setIndex(Math.max(0, Math.min(SLIDE_COUNT - 1, next)));
  };

  return (
    <div className="app-intro" role="dialog" aria-label={t('appIntro.aria')}>
      <div
        className="app-intro__viewport"
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
          className="app-intro__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <section key={i} className="app-intro__slide" aria-hidden={i !== index}>
              <p className="app-intro__sample">
                {t('appIntro.sample', { n: i + 1 })}
              </p>
            </section>
          ))}
        </div>
      </div>

      <div className="app-intro__dots" role="tablist" aria-label={t('appIntro.aria')}>
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`app-intro__dot${i === index ? ' is-active' : ''}`}
            onClick={() => go(i)}
            aria-label={t('appIntro.sample', { n: i + 1 })}
            aria-current={i === index ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
