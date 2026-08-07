import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinPad, PIN_LENGTH } from './PinPad';
import './ScreenLock.css';

interface ScreenLockGateProps {
  onUnlock: (password: string) => Promise<boolean>;
}

/** 앱 잠금 해제 — 전체 화면 키패드 */
function ScreenLockGate({ onUnlock }: ScreenLockGateProps) {
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

  const tryUnlock = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const ok = await onUnlock(value);
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
    <div className="pin-screen" role="dialog" aria-modal="true" aria-label={t('lock.gateAria')}>
      <header className="pin-screen__head">
        <span className="pin-screen__nav pin-screen__nav--spacer" />
        <span className="pin-screen__brand">PageBy</span>
        <span className="pin-screen__nav pin-screen__nav--spacer" />
      </header>

      <div className={`pin-screen__body${shake ? ' is-shake' : ''}`}>
        <h1 className="pin-screen__title">{t('lock.pinTitle')}</h1>
        <p className="pin-screen__hint">{t('lock.gateHint')}</p>
        {error && <p className="pin-screen__error">{error}</p>}
        <PinPad
          value={pin}
          maxLength={PIN_LENGTH}
          disabled={busy}
          onChange={(next) => {
            setPin(next);
            setError(null);
          }}
          onComplete={(done) => void tryUnlock(done)}
        />
      </div>
    </div>
  );
}

export default ScreenLockGate;
