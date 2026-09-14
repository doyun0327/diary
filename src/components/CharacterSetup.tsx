import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ACCESSORY_OPTIONS,
  defaultHairForGender,
  GENDER_EMOJI,
  GENDER_OPTIONS,
  hairOptionsForGender,
  OUTFIT_OPTIONS,
  type CharacterProfile,
} from '../types/character';
import { markCharacterSetupDone } from '../utils/onboarding';
import './CharacterSetup.css';

interface CharacterSetupProps {
  character: CharacterProfile;
  onChange: (next: CharacterProfile) => void;
  onClose: () => void;
  /** 완료(완료 버튼) 시 — 첫 온보딩에서 쓰기 화면으로 보낼 때 사용 */
  onComplete?: () => void;
}

function CharacterSetup({ character, onChange, onClose, onComplete }: CharacterSetupProps) {
  const { t } = useTranslation();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  const handleDone = () => {
    markCharacterSetupDone();
    onComplete?.();
    onClose();
  };

  const hairOptions = hairOptionsForGender(character.gender);

  const setGender = (gender: CharacterProfile['gender']) => {
    const allowed = hairOptionsForGender(gender);
    const hairOk = allowed.some((opt) => opt.value === character.hairStyle);
    onChange({
      ...character,
      gender,
      hairStyle: hairOk ? character.hairStyle : defaultHairForGender(gender),
    });
  };

  return (
    <>
      <div className="character-setup__backdrop" onClick={onClose} />
      <div className="character-setup" role="dialog" aria-label={t('character.dialogAria')}>
        <header className="character-setup__head">
          <h2>{t('character.title')}</h2>
          <button type="button" onClick={handleDone}>
            {t('character.done')}
          </button>
        </header>
        <p className="character-setup__desc">{t('character.desc')}</p>

        <section>
          <h3>{t('character.who')}</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {GENDER_OPTIONS.map((opt) => {
              const label = t(`character.gender.${opt.value}`);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`character-setup__emoji-btn ${character.gender === opt.value ? 'selected' : ''}`}
                  onClick={() => {
                    setGender(opt.value);
                    showToast(label);
                  }}
                  aria-label={label}
                  title={label}
                >
                  <span className="character-setup__emoji">{GENDER_EMOJI[opt.value]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3>{t('character.hairLabel')}</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {hairOptions.map((opt) => {
              const label = t(`character.hair.${opt.value}`);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`character-setup__emoji-btn character-setup__emoji-btn--hair ${character.hairStyle === opt.value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange({ ...character, hairStyle: opt.value });
                    showToast(label);
                  }}
                  aria-label={label}
                  title={label}
                >
                  <img
                    className="character-setup__hair-img"
                    src={opt.image}
                    alt=""
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3>{t('character.outfitLabel')}</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {OUTFIT_OPTIONS.map((opt) => {
              const label = t(`character.outfit.${opt.value}`);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`character-setup__emoji-btn ${character.outfit === opt.value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange({ ...character, outfit: opt.value });
                    showToast(label);
                  }}
                  aria-label={label}
                  title={label}
                >
                  <span className="character-setup__emoji">{opt.emoji}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3>{t('character.accessoryLabel')}</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {ACCESSORY_OPTIONS.map((opt) => {
              const label = t(`character.accessory.${opt.value}`);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`character-setup__emoji-btn ${character.accessory === opt.value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange({ ...character, accessory: opt.value });
                    showToast(label);
                  }}
                  aria-label={label}
                  title={label}
                >
                  <span className="character-setup__emoji">{opt.emoji}</span>
                </button>
              );
            })}
          </div>
        </section>

        {toast ? (
          <div className="character-setup__toast" role="status">
            {toast}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default CharacterSetup;
