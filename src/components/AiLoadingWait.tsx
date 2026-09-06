import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLottie } from 'lottie-react';
import { useTranslation } from 'react-i18next';
import { AI_PROGRESS_STEPS, type AiProgress } from '../api/aiImage';
import { keywordsFromDiary } from '../utils/aiWaitKeywords';
import './AiLoadingWait.css';

const MAX_FLOATING = 4;

const PASTELS = [
  '#e8a99a',
  '#9ecfb8',
  '#c5b4e0',
  '#a8c8e8',
  '#e6d39a',
  '#e4b0c6',
  '#b8d4a8',
  '#f0c3a8',
];

const SIZES = [1.15, 1.5, 1.9, 2.4, 2.95, 3.4];

type Floater = {
  id: number;
  word: string;
  top: number;
  left: number;
  rotate: number;
  delay: number;
  scale: number;
  drift: number;
  color: string;
  size: number;
};

function pickPosition(used: Pick<Floater, 'top' | 'left'>[]): { top: number; left: number } {
  for (let i = 0; i < 28; i += 1) {
    const top = 7 + Math.random() * 74;
    const left = 8 + Math.random() * 84;
    const overLottie = top > 24 && top < 64 && left > 30 && left < 70;
    if (overLottie) continue;
    const tooClose = used.some((spot) => Math.hypot(spot.top - top, spot.left - left) < 18);
    if (tooClose) continue;
    return { top, left };
  }
  return {
    top: Math.random() < 0.5 ? 8 + Math.random() * 14 : 74 + Math.random() * 12,
    left: 8 + Math.random() * 84,
  };
}

function pickPastel(used: string[]): string {
  const free = PASTELS.filter((color) => !used.includes(color));
  const pool = free.length > 0 ? free : PASTELS;
  return pool[Math.floor(Math.random() * pool.length)] ?? PASTELS[0];
}

function pickSize(used: number[]): number {
  const free = SIZES.filter((size) => !used.includes(size));
  const pool = free.length > 0 ? free : SIZES;
  return pool[Math.floor(Math.random() * pool.length)] ?? SIZES[2];
}

function makeFloater(word: string, id: number, delay: number, used: Floater[]): Floater {
  const pos = pickPosition(used);
  return {
    id,
    word,
    ...pos,
    rotate: Math.round((Math.random() * 26 - 13) * 10) / 10,
    delay,
    scale: 1,
    drift: Math.round((Math.random() * 22 - 11) * 10) / 10,
    color: pickPastel(used.map((item) => item.color)),
    size: pickSize(used.map((item) => item.size)),
  };
}

function AiLoadingLottie({ animationData }: { animationData: object }) {
  const { View, play, animationItem } = useLottie({
    animationData,
    loop: true,
    autoplay: true,
  });

  useEffect(() => {
    let wasHidden = document.visibilityState === 'hidden';
    const resume = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden) {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return;
      wasHidden = false;
      try {
        animationItem?.goToAndPlay?.(0, true);
      } catch {
        // ignore
      }
      play?.();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, [play, animationItem]);

  return <div className="ai-loading-wait__lottie">{View}</div>;
}

const STEP_LABEL_KEYS: Record<AiProgress, string> = {
  waiting: 'write.ai.stepWaiting',
  drawing: 'write.ai.stepDrawing',
  finishing: 'write.ai.stepFinishing',
};

interface AiLoadingWaitProps {
  animationData: object | null;
  lottieKey: number;
  step: AiProgress;
  sourceText?: string;
  /** 오일파스텔 등 오래 걸릴 때 안내 토스트 */
  durationHint?: boolean;
}

export default function AiLoadingWait({
  animationData,
  lottieKey,
  step,
  sourceText = '',
  durationHint = false,
}: AiLoadingWaitProps) {
  const { t } = useTranslation();
  const activeIndex = AI_PROGRESS_STEPS.indexOf(step);
  const keywords = useMemo(() => keywordsFromDiary(sourceText), [sourceText]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [hintVisible, setHintVisible] = useState(durationHint);
  const [resumeKey, setResumeKey] = useState(0);
  const cursorRef = useRef(0);
  const idRef = useRef(MAX_FLOATING);

  useEffect(() => {
    let wasHidden = document.visibilityState === 'hidden';
    let timer: number | null = null;
    const remountOnShow = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden) {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return;
      wasHidden = false;
      if (timer != null) window.clearTimeout(timer);
      // WebView는 resume 직후 rAF가 한 박자 늦을 수 있음
      timer = window.setTimeout(() => {
        setResumeKey((key) => key + 1);
      }, 80);
    };
    document.addEventListener('visibilitychange', remountOnShow);
    window.addEventListener('pageshow', remountOnShow);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', remountOnShow);
      window.removeEventListener('pageshow', remountOnShow);
    };
  }, []);

  useEffect(() => {
    if (!durationHint) {
      setHintVisible(false);
      return;
    }
    setHintVisible(true);
    const timer = window.setTimeout(() => setHintVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [durationHint]);

  useEffect(() => {
    const next: Floater[] = [];
    const count = Math.min(MAX_FLOATING, keywords.length);
    for (let index = 0; index < count; index += 1) {
      next.push(makeFloater(keywords[index], index + 1, index * 1.2, next));
    }
    cursorRef.current = count;
    idRef.current = count;
    setFloaters(next);
  }, [keywords]);

  const rotateWord = useCallback(
    (id: number) => {
      setFloaters((prev) => {
        const current = prev.find((item) => item.id === id);
        if (!current || keywords.length === 0) return prev;
        const others = prev.filter((item) => item.id !== id);
        const visible = new Set(others.map((item) => item.word));
        let word = current.word;
        for (let i = 0; i < keywords.length; i += 1) {
          const candidate = keywords[cursorRef.current % keywords.length];
          cursorRef.current += 1;
          if (candidate === current.word && keywords.length > 1) continue;
          if (visible.has(candidate) && visible.size < keywords.length) continue;
          word = candidate;
          break;
        }
        idRef.current += 1;
        return [...others, makeFloater(word, idRef.current, 0, others)];
      });
    },
    [keywords],
  );

  return (
    <div
      className="ai-loading-wait"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={t(STEP_LABEL_KEYS[step])}
    >
      <div className="ai-loading-wait__keywords" aria-hidden>
        {floaters.map((item) => (
          <p
            key={item.id}
            className="ai-loading-wait__keyword"
            style={
              {
                '--kw-top': `${item.top}%`,
                '--kw-left': `${item.left}%`,
                '--kw-rotate': `${item.rotate}deg`,
                '--kw-delay': `${item.delay}s`,
                '--kw-scale': String(item.scale),
                '--kw-drift': `${item.drift}px`,
                '--kw-color': item.color,
                '--kw-size': `${item.size}rem`,
              } as CSSProperties
            }
            onAnimationEnd={(event) => {
              if (event.target !== event.currentTarget) return;
              rotateWord(item.id);
            }}
          >
            {item.word}
          </p>
        ))}
      </div>
      <div className="ai-loading-wait__panel">
        <div className="ai-loading-wait__stage">
          {animationData ? (
            <AiLoadingLottie
              key={`${lottieKey}-${resumeKey}`}
              animationData={animationData}
            />
          ) : (
            <div className="ai-loading-wait__lottie" />
          )}
        </div>
        {hintVisible ? (
          <div className="ai-loading-wait__toast" role="status">
            {t('write.ai.durationHint')}
          </div>
        ) : null}
        <div className="ai-loading-wait__track" aria-hidden>
          {AI_PROGRESS_STEPS.map((id, index) => (
            <Fragment key={id}>
              <div
                className={`ai-loading-wait__step${index === activeIndex ? ' is-active' : ''}${index < activeIndex ? ' is-done' : ''}`}
              >
                <span className="ai-loading-wait__step-dot" />
                <span className="ai-loading-wait__step-label">{t(STEP_LABEL_KEYS[id])}</span>
              </div>
              {index < AI_PROGRESS_STEPS.length - 1 ? (
                <div
                  className={`ai-loading-wait__connector${index === activeIndex ? ' is-active' : ''}${index < activeIndex ? ' is-done' : ''}`}
                >
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
