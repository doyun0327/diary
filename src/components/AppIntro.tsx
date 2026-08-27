import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './AppIntro.css';

/** 1·2·3 소개 → 9 (체험/혜택) */
const INTRO_IMAGES = [1, 2, 3, 9] as const;
const SLIDE_COUNT = INTRO_IMAGES.length;

type AppIntroProps = {
  onFinish: () => void;
};

/** 첫 실행 앱 소개 — public/intro 이미지 가로 슬라이드 */
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
          {INTRO_IMAGES.map((n, i) => (
            <section key={n} className="app-intro__slide" aria-hidden={i !== index}>
              <img
                className="app-intro__image"
                src={`/intro/${n}.png`}
                alt={t('appIntro.sample', { n })}
                draggable={false}
              />
            </section>
          ))}
        </div>
      </div>

      <div className="app-intro__dots" role="tablist" aria-label={t('appIntro.aria')}>
        {INTRO_IMAGES.map((n, i) => (
          <button
            key={n}
            type="button"
            className={`app-intro__dot${i === index ? ' is-active' : ''}`}
            onClick={() => go(i)}
            aria-label={t('appIntro.sample', { n })}
            aria-current={i === index ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
