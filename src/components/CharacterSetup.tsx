import { useTranslation } from 'react-i18next';
import {
  ACCESSORY_OPTIONS,
  GENDER_OPTIONS,
  HAIR_STYLE_OPTIONS,
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

const GENDER_EMOJI: Record<CharacterProfile['gender'], string> = {
  boy: '👦🏻',
  girl: '👧🏻',
};

function CharacterSetup({ character, onChange, onClose, onComplete }: CharacterSetupProps) {
  const { t } = useTranslation();

  const handleDone = () => {
    markCharacterSetupDone();
    onComplete?.();
    onClose();
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
          <div className="character-setup__emoji-row">
            {GENDER_OPTIONS.map((opt) => {
              const label = t(`character.gender.${opt.value}`);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`character-setup__emoji-btn ${character.gender === opt.value ? 'selected' : ''}`}
                  onClick={() => onChange({ ...character, gender: opt.value })}
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
            {HAIR_STYLE_OPTIONS.map((opt) => {
              const label = t(`character.hair.${opt.value}`);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`character-setup__emoji-btn ${character.hairStyle === opt.value ? 'selected' : ''}`}
                  onClick={() => onChange({ ...character, hairStyle: opt.value })}
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
          <h3>{t('character.outfitLabel')}</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {OUTFIT_OPTIONS.map((opt) => {
              const label = t(`character.outfit.${opt.value}`);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`character-setup__emoji-btn ${character.outfit === opt.value ? 'selected' : ''}`}
                  onClick={() => onChange({ ...character, outfit: opt.value })}
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
                  onClick={() => onChange({ ...character, accessory: opt.value })}
                  aria-label={label}
                  title={label}
                >
                  <span className="character-setup__emoji">{opt.emoji}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

export default CharacterSetup;
