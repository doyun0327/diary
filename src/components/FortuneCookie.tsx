import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FORTUNE_COUNT, FORTUNE_MESSAGES } from '../data/fortuneMessages';
import './FortuneCookie.css';

const COOKIE_IMG = '/fortune/cookie.png';

interface FortuneCookieProps {
  className?: string;
  /** × 로 닫을 때 (부모에서 레이어 제거) */
  onDismiss?: () => void;
}

function pickFortune(lang: string): string {
  const list =
    lang.startsWith('ko') ? FORTUNE_MESSAGES.ko : FORTUNE_MESSAGES.en;
  return list[Math.floor(Math.random() * FORTUNE_COUNT)] ?? list[0];
}

/** 제공 이미지 포춘쿠키 — 한 번만 열림, × 눌러야 사라짐 */
export default function FortuneCookie({
  className = '',
  onDismiss,
}: FortuneCookieProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open || !message) {
      setTyped('');
      return;
    }

    const chars = Array.from(message);
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setTyped(message);
      return;
    }

    setTyped('');
    let i = 0;
    let intervalId = 0;
    const startId = window.setTimeout(() => {
      const ms = chars.length > 80 ? 78 : 95;
      intervalId = window.setInterval(() => {
        i += 1;
        setTyped(chars.slice(0, i).join(''));
        if (i >= chars.length) window.clearInterval(intervalId);
      }, ms);
    }, 380);

    return () => {
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
  }, [open, message]);

  const crackOpen = () => {
    if (open) return;
    setMessage(pickFortune(i18n.language));
    setOpen(true);
  };

  const closeSlip = () => {
    onDismiss?.();
  };

  return (
    <div
      className={`ai-fortune${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <div
        className="ai-fortune__visual"
        role={open ? undefined : 'button'}
        tabIndex={open ? undefined : 0}
        aria-label={open ? undefined : t('write.ai.fortune.tapAria')}
        onClick={open ? undefined : crackOpen}
        onKeyDown={
          open
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  crackOpen();
                }
              }
        }
      >
        <div className="ai-fortune__piece ai-fortune__piece--left" aria-hidden>
          <img src={COOKIE_IMG} alt="" draggable={false} />
        </div>

        {open ? (
          <div className="ai-fortune__slip" role="status">
            <button
              type="button"
              className="ai-fortune__close"
              onClick={closeSlip}
              aria-label={t('write.ai.fortune.close')}
            >
              ×
            </button>
            <span className="ai-fortune__slip-label">
              {t('write.ai.fortune.label')}
            </span>
            <span className="ai-fortune__slip-text">
              {typed}
              {typed.length < message.length ? (
                <span className="ai-fortune__caret" aria-hidden />
              ) : null}
            </span>
          </div>
        ) : null}

        <div className="ai-fortune__piece ai-fortune__piece--right" aria-hidden>
          <img src={COOKIE_IMG} alt="" draggable={false} />
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          className="ai-fortune__hint-btn"
          onClick={crackOpen}
        >
          {t('write.ai.fortune.tap')}
        </button>
      ) : null}
    </div>
  );
}
