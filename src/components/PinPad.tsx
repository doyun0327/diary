import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './ScreenLock.css';

export const PIN_LENGTH = 4;

interface PinPadProps {
  value: string;
  maxLength?: number;
  disabled?: boolean;
  onChange: (next: string) => void;
  /** 자릿수가 찼을 때 (키패드/키보드로) */
  onComplete?: (pin: string) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** 숫자 점 + 키패드 */
export function PinPad({
  value,
  maxLength = PIN_LENGTH,
  disabled = false,
  onChange,
  onComplete,
}: PinPadProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (value.length >= maxLength) return;
        const next = value + e.key;
        onChange(next);
        if (next.length === maxLength) onComplete?.(next);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        onChange(value.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, maxLength, onChange, onComplete, value]);

  const press = (key: (typeof KEYS)[number]) => {
    if (disabled || key === '') return;
    if (key === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    const next = value + key;
    onChange(next);
    if (next.length === maxLength) onComplete?.(next);
  };

  return (
    <div className="pin-pad">
      <div className="pin-pad__dots" aria-hidden>
        {Array.from({ length: maxLength }, (_, i) => (
          <span
            key={i}
            className={`pin-pad__dot${i < value.length ? ' is-filled' : ''}`}
          />
        ))}
      </div>
      <div className="pin-pad__keys" role="group" aria-label={t('lock.keypadAria')}>
        {KEYS.map((key, i) => {
          if (key === '') {
            return <span key={`empty-${i}`} className="pin-pad__key pin-pad__key--empty" />;
          }
          if (key === 'del') {
            return (
              <button
                key="del"
                type="button"
                className="pin-pad__key pin-pad__key--action"
                disabled={disabled || value.length === 0}
                aria-label={t('lock.delete')}
                onClick={() => press('del')}
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              className="pin-pad__key"
              disabled={disabled}
              onClick={() => press(key)}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
