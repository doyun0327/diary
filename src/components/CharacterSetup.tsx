import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ACCESSORY_OPTIONS,
  createPet,
  GENDER_OPTIONS,
  HAIR_STYLE_OPTIONS,
  MAX_PETS,
  OUTFIT_OPTIONS,
  PET_COLOR_OPTIONS,
  PET_KIND_OPTIONS,
  sanitizePetNote,
  type CharacterPet,
  type CharacterProfile,
  type PetKind,
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
  girl: '👧🏻',
  boy: '👦🏻',
  woman: '👩🏻',
  man: '👨🏻',
};

function CharacterSetup({ character, onChange, onClose, onComplete }: CharacterSetupProps) {
  const { t } = useTranslation();
  const pets = character.pets ?? [];
  const canAddPet = pets.length < MAX_PETS;
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

  const addPet = (kind: PetKind) => {
    if (!canAddPet) return;
    onChange({ ...character, pets: [...pets, createPet(kind)] });
  };

  const updatePet = (id: string, patch: Partial<CharacterPet>) => {
    onChange({
      ...character,
      pets: pets.map((pet) => (pet.id === id ? { ...pet, ...patch } : pet)),
    });
  };

  const removePet = (id: string) => {
    onChange({
      ...character,
      pets: pets.filter((pet) => pet.id !== id),
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
                  onClick={() => {
                    onChange({ ...character, hairStyle: opt.value });
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

        <section>
          <h3>{t('character.petLabel')}</h3>
          <p className="character-setup__hint">
            {t('character.petHint', { max: MAX_PETS })}
          </p>

          {pets.length === 0 ? (
            <p className="character-setup__empty">{t('character.petEmpty')}</p>
          ) : (
            <ul className="character-setup__pet-list">
              {pets.map((pet, index) => {
                const kindMeta = PET_KIND_OPTIONS.find((o) => o.value === pet.kind);
                const isOn = pet.enabled !== false;
                return (
                  <li
                    key={pet.id}
                    className={`character-setup__pet-card${isOn ? '' : ' is-off'}`}
                  >
                    <div className="character-setup__pet-card-head">
                      <span className="character-setup__pet-card-title">
                        <span aria-hidden>{kindMeta?.emoji ?? '🐾'}</span>
                        {t(`character.pet.${pet.kind}`)} {index + 1}
                      </span>
                      <div className="character-setup__pet-card-actions">
                        <button
                          type="button"
                          className={`character-setup__pet-toggle${isOn ? ' is-on' : ''}`}
                          aria-pressed={isOn}
                          onClick={() => updatePet(pet.id, { enabled: !isOn })}
                        >
                          {isOn ? t('character.petOn') : t('character.petOff')}
                        </button>
                        <button
                          type="button"
                          className="character-setup__pet-remove"
                          onClick={() => removePet(pet.id)}
                        >
                          {t('character.petRemove')}
                        </button>
                      </div>
                    </div>
                    <h4 className="character-setup__subhead">{t('character.petColorLabel')}</h4>
                    <div className="character-setup__swatch-row" role="list">
                      {PET_COLOR_OPTIONS.map((opt) => {
                        const label = t(`character.petColor.${opt.value}`);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="listitem"
                            className={`character-setup__swatch ${pet.color === opt.value ? 'selected' : ''}`}
                            style={{ background: opt.swatch }}
                            onClick={() => updatePet(pet.id, { color: opt.value })}
                            aria-label={label}
                            title={label}
                            disabled={!isOn}
                          />
                        );
                      })}
                    </div>
                    <label className="character-setup__note">
                      <span>{t('character.petNoteLabel')}</span>
                      <input
                        type="text"
                        maxLength={40}
                        value={pet.note}
                        placeholder={t('character.petNotePlaceholder')}
                        disabled={!isOn}
                        onChange={(e) =>
                          updatePet(pet.id, { note: sanitizePetNote(e.target.value) })
                        }
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="character-setup__pet-add-row">
            {PET_KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="character-setup__pet-add"
                disabled={!canAddPet}
                onClick={() => addPet(opt.value)}
              >
                <span aria-hidden>{opt.emoji}</span>
                {t('character.petAdd', { kind: t(`character.pet.${opt.value}`) })}
              </button>
            ))}
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
