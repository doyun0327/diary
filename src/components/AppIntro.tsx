import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  nyangTicketIntroSrc,
  preloadNyangTicketImages,
  subscribeNyangTicketImagesReady,
} from '../utils/nyangTicketImages';
import './AppIntro.css';

/** public/intro 구독 혜택 이미지 */
const INTRO_IMAGES = [
  { id: 'draw50', file: '50장.png', labelKey: 'nyangTicket.benefitDraw50' },
  { id: 'pdf', file: 'pdf저장.png', labelKey: 'nyangTicket.benefitPdf' },
  { id: 'search', file: '검색.png', labelKey: 'nyangTicket.benefitSearch' },
  { id: 'noAds', file: '광고제거.png', labelKey: 'nyangTicket.benefitNoAds' },
] as const;
const SLIDE_COUNT = INTRO_IMAGES.length;

type AppIntroProps = {
  onFinish: () => void;
};

/** 첫 실행 앱 소개 — public/intro 이미지 가로 슬라이드 */
export default function AppIntro({ onFinish }: AppIntroProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [cacheTick, setCacheTick] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    preloadNyangTicketImages();
    return subscribeNyangTicketImagesReady(() => setCacheTick((n) => n + 1));
  }, []);

  const go = (next: number) => {
    if (next >= SLIDE_COUNT) {
      onFinish();
      return;
    }
    setIndex(Math.max(0, Math.min(SLIDE_COUNT - 1, next)));
  };

  void cacheTick;

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
          {INTRO_IMAGES.map((item, i) => (
            <section key={item.id} className="app-intro__slide" aria-hidden={i !== index}>
              <img
                className="app-intro__image"
                src={nyangTicketIntroSrc(item.file)}
                alt={t(item.labelKey)}
                draggable={false}
              />
            </section>
          ))}
        </div>
      </div>

      <div className="app-intro__dots" role="tablist" aria-label={t('appIntro.aria')}>
        {INTRO_IMAGES.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`app-intro__dot${i === index ? ' is-active' : ''}`}
            onClick={() => go(i)}
            aria-label={t(item.labelKey)}
            aria-current={i === index ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
