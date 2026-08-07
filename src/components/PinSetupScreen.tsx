import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinPad, PIN_LENGTH } from './PinPad';
import './ScreenLock.css';

type SetupStep = 'create' | 'confirm';

interface PinSetupScreenProps {
  onDone: (pin: string) => Promise<void>;
  onCancel: () => void;
}

/** 전체 화면 비밀번호 최초 설정 — 입력 → 확인 */
function PinSetupScreen({ onDone, onCancel }: PinSetupScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<SetupStep>('create');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
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

  const flashShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  };

  const handleCreateComplete = (pin: string) => {
    setFirst(pin);
    setSecond('');
    setError(null);
    setStep('confirm');
  };

  const handleConfirmComplete = async (pin: string) => {
    if (pin !== first) {
      setError(t('lock.err.mismatch'));
      flashShake();
      setSecond('');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onDone(pin);
    } catch {
      setError(t('lock.err.save'));
      setSecond('');
    } finally {
      setBusy(false);
    }
  };

  const pin = step === 'create' ? first : second;
  const setPin = step === 'create' ? setFirst : setSecond;

  return (
    <div className="pin-screen" role="dialog" aria-modal="true" aria-label={t('lock.enableTitle')}>
      <header className="pin-screen__head">
        <button type="button" className="pin-screen__nav" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </button>
        <span className="pin-screen__brand">PageBy</span>
        <span className="pin-screen__nav pin-screen__nav--spacer" />
      </header>

      <div className={`pin-screen__body${shake ? ' is-shake' : ''}`}>
        <h1 className="pin-screen__title">{t('lock.pinTitle')}</h1>
        <p className="pin-screen__hint">
          {step === 'create' ? t('lock.pinEnterHint') : t('lock.pinConfirmHint')}
        </p>
        {error && <p className="pin-screen__error">{error}</p>}
        <PinPad
          value={pin}
          maxLength={PIN_LENGTH}
          disabled={busy}
          onChange={(next) => {
            setPin(next);
            setError(null);
          }}
          onComplete={(done) => {
            if (step === 'create') handleCreateComplete(done);
            else void handleConfirmComplete(done);
          }}
        />
        {step === 'confirm' && (
          <button
            type="button"
            className="pin-screen__redo"
            disabled={busy}
            onClick={() => {
              setStep('create');
              setFirst('');
              setSecond('');
              setError(null);
            }}
          >
            {t('lock.pinRestart')}
          </button>
        )}
      </div>
    </div>
  );
}

export default PinSetupScreen;
