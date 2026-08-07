import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinPad, PIN_LENGTH } from './PinPad';
import './ScreenLock.css';

interface PinVerifyScreenProps {
  title?: string;
  hint: string;
  onVerified: (pin: string) => Promise<boolean>;
  onCancel: () => void;
}

/** 전체 화면 — 기존 PIN 확인 (잠금 끄기 등) */
function PinVerifyScreen({ title, hint, onVerified, onCancel }: PinVerifyScreenProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const ok = await onVerified(value);
      if (!ok) {
        setError(t('lock.err.wrongPassword'));
        setShake(true);
        window.setTimeout(() => setShake(false), 420);
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pin-screen" role="dialog" aria-modal="true" aria-label={title ?? t('lock.pinTitle')}>
      <header className="pin-screen__head">
        <button type="button" className="pin-screen__nav" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </button>
        <span className="pin-screen__brand">PageBy</span>
        <span className="pin-screen__nav pin-screen__nav--spacer" />
      </header>

      <div className={`pin-screen__body${shake ? ' is-shake' : ''}`}>
        <h1 className="pin-screen__title">{title ?? t('lock.pinTitle')}</h1>
        <p className="pin-screen__hint">{hint}</p>
        {error && <p className="pin-screen__error">{error}</p>}
        <PinPad
          value={pin}
          maxLength={PIN_LENGTH}
          disabled={busy}
          onChange={(next) => {
            setPin(next);
            setError(null);
          }}
          onComplete={(done) => void submit(done)}
        />
      </div>
    </div>
  );
}

export default PinVerifyScreen;
