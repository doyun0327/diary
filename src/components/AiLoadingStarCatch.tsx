import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import './AiLoadingStarCatch.css';

const STAR_EMOJIS = ['✨', '⭐', '🌟', '💫'] as const;
const MAX_STARS = 18;
const WAVE_INTERVAL_MS = 2000;
const BASE_FALL_SEC = 2.6;
const MIN_FALL_SEC = 0.85;
const FALL_SPEED_STEP = 0.32;

type FallingStar = {
  id: number;
  x: number;
  emoji: string;
  durationSec: number;
  rot: number;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createStar(id: number, waveIndex: number): FallingStar {
  const durationSec = Math.max(
    MIN_FALL_SEC,
    BASE_FALL_SEC - waveIndex * FALL_SPEED_STEP + randomBetween(-0.12, 0.12),
  );

  return {
    id,
    x: randomBetween(10, 90),
    emoji: STAR_EMOJIS[Math.floor(Math.random() * STAR_EMOJIS.length)] ?? '✨',
    durationSec,
    rot: randomBetween(-24, 24),
  };
}

export default function AiLoadingStarCatch() {
  const { t } = useTranslation();
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState<FallingStar[]>([]);
  const idRef = useRef(0);
  const removedRef = useRef(new Set<number>());

  useEffect(() => {
    removedRef.current.clear();
    idRef.current = 0;
    setScore(0);
    setStars([]);

    let waveIndex = 0;

    const spawnWave = () => {
      const batchSize = waveIndex + 1;
      setStars((prev) => {
        const room = MAX_STARS - prev.length;
        if (room <= 0) return prev;

        const toAdd = Math.min(batchSize, room);
        const next = [...prev];
        for (let i = 0; i < toAdd; i += 1) {
          idRef.current += 1;
          next.push(createStar(idRef.current, waveIndex));
        }
        return next;
      });
      waveIndex += 1;
    };

    spawnWave();
    const waveTimer = window.setInterval(spawnWave, WAVE_INTERVAL_MS);

    return () => {
      window.clearInterval(waveTimer);
    };
  }, []);

  const removeStar = (id: number) => {
    if (removedRef.current.has(id)) return;
    removedRef.current.add(id);
    setStars((prev) => prev.filter((star) => star.id !== id));
  };

  const handleCatch = (id: number) => {
    removeStar(id);
    setScore((value) => value + 1);
  };

  return (
    <div className="ai-star-catch">
      <div className="ai-star-catch__hud">
        <p className="ai-star-catch__hint">{t('write.ai.starHint')}</p>
        {score > 0 ? (
          <p className="ai-star-catch__score">{t('write.ai.starScore', { count: score })}</p>
        ) : null}
      </div>
      <div className="ai-star-catch__field">
        {stars.map((star) => (
          <button
            key={star.id}
            type="button"
            className="ai-star-catch__star"
            style={
              {
                left: `${star.x}%`,
                '--fall-duration': `${star.durationSec}s`,
                '--fall-rot': `${star.rot}deg`,
              } as CSSProperties
            }
            onPointerDown={(event) => {
              event.preventDefault();
              handleCatch(star.id);
            }}
            onAnimationEnd={() => removeStar(star.id)}
            aria-label={t('write.ai.starTap')}
          >
            {star.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
