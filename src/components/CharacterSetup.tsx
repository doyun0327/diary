import {
  ACCESSORY_OPTIONS,
  GENDER_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  OUTFIT_OPTIONS,
  SHOE_OPTIONS,
  SKIN_OPTIONS,
  summarizeCharacterKo,
  type CharacterProfile,
} from '../types/character';
import { HAIR_COLOR_HEX, HairStyleIcon, resolveHairHex } from './CharacterIcons';
import './CharacterSetup.css';

interface CharacterSetupProps {
  character: CharacterProfile;
  onChange: (next: CharacterProfile) => void;
  onClose: () => void;
}

const SKIN_SWATCH: Record<CharacterProfile['skin'], string> = {
  light: '#f8e4d0',
  warm: '#e0b888',
  deep: '#6b3f2a',
};

const GENDER_EMOJI: Record<CharacterProfile['gender'], string> = {
  boy: '👦',
  girl: '👧',
  kid: '🧒',
};

const SHOE_EMOJI: Record<CharacterProfile['shoes'], string> = {
  sneakers: '👟',
  boots: '🥾',
  sandals: '👡',
  'dress-shoes': '👞',
  'rain-boots': '👢',
  barefoot: '🦶',
};

const ACCESSORY_EMOJI: Record<CharacterProfile['accessories'][number], string> = {
  none: '🚫',
  glasses: '👓',
  sunglasses: '🕶️',
  hat: '🎩',
  cap: '🧢',
  headband: '👑',
  ribbon: '🎀',
  backpack: '🎒',
  'crossbody-bag': '👜',
  watch: '⌚',
  scarf: '🧣',
  mask: '😷',
};

function CharacterSetup({ character, onChange, onClose }: CharacterSetupProps) {
  const hairHex = resolveHairHex(character);

  const toggleAccessory = (value: CharacterProfile['accessories'][number]) => {
    if (value === 'none') {
      onChange({ ...character, accessories: ['none'] });
      return;
    }

    const withoutNone = character.accessories.filter((a) => a !== 'none');
    const exists = withoutNone.includes(value);
    const next = exists
      ? withoutNone.filter((a) => a !== value)
      : [...withoutNone, value];

    onChange({
      ...character,
      accessories: next.length === 0 ? ['none'] : next,
    });
  };

  return (
    <>
      <div className="character-setup__backdrop" onClick={onClose} />
      <div className="character-setup" role="dialog" aria-label="내 캐릭터 설정">
        <header className="character-setup__head">
          <h2>내 캐릭터</h2>
          <button type="button" onClick={onClose}>
            완료
          </button>
        </header>

        <p className="character-setup__summary">{summarizeCharacterKo(character)}</p>
        <p className="character-setup__desc">
          그림을 눌러 고르세요. 길게 누르면 이름이 보여요.
        </p>

        <section>
          <h3>누구인가요?</h3>
          <div className="character-setup__emoji-row">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__emoji-btn ${character.gender === opt.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...character, gender: opt.value })}
                aria-label={opt.label}
                title={opt.label}
              >
                <span className="character-setup__emoji">{GENDER_EMOJI[opt.value]}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>피부</h3>
          <div className="character-setup__emoji-row">
            {SKIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__emoji-btn ${character.skin === opt.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...character, skin: opt.value })}
                aria-label={opt.label}
                title={opt.label}
              >
                <span
                  className="character-setup__swatch"
                  style={{ background: SKIN_SWATCH[opt.value] }}
                />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>머리 색</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {HAIR_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__emoji-btn character-setup__emoji-btn--labeled ${character.hairColor === opt.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...character, hairColor: opt.value })}
                aria-label={opt.label}
                title={opt.label}
              >
                {opt.value === 'custom' ? (
                  <span className="character-setup__emoji">🎨</span>
                ) : (
                  <span
                    className="character-setup__swatch character-setup__swatch--hair"
                    style={{ background: HAIR_COLOR_HEX[opt.value] }}
                  />
                )}
                <span className="character-setup__emoji-caption">{opt.label}</span>
              </button>
            ))}
          </div>
          {character.hairColor === 'custom' && (
            <label className="character-setup__color">
              <span className="character-setup__emoji character-setup__emoji--sm">🎨</span>
              <input
                type="color"
                value={character.hairHex}
                onChange={(e) => onChange({ ...character, hairHex: e.target.value })}
              />
            </label>
          )}
        </section>

        <section>
          <h3>머리 모양</h3>
          <div className="character-setup__visual-grid">
            {HAIR_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__visual ${character.hairStyle === opt.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...character, hairStyle: opt.value })}
                aria-label={opt.label}
                title={opt.label}
              >
                <HairStyleIcon style={opt.value} color={hairHex} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>옷</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {OUTFIT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__emoji-btn character-setup__emoji-btn--labeled ${character.outfit === opt.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...character, outfit: opt.value })}
                aria-label={opt.label}
                title={opt.label}
              >
                <span className="character-setup__emoji">{opt.emoji}</span>
                <span className="character-setup__emoji-caption">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>신발</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {SHOE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__emoji-btn ${character.shoes === opt.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...character, shoes: opt.value })}
                aria-label={opt.label}
                title={opt.label}
              >
                <span className="character-setup__emoji">{SHOE_EMOJI[opt.value]}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>액세서리</h3>
          <div className="character-setup__emoji-row character-setup__emoji-row--wrap">
            {ACCESSORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__emoji-btn ${character.accessories.includes(opt.value) ? 'selected' : ''}`}
                onClick={() => toggleAccessory(opt.value)}
                aria-label={opt.label}
                title={opt.label}
              >
                <span className="character-setup__emoji">{ACCESSORY_EMOJI[opt.value]}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>자유 설명</h3>
          <textarea
            className="character-setup__note"
            rows={3}
            maxLength={120}
            placeholder="예: 주근깨가 있어요, 왼손에 인형을 들어요"
            value={character.customNote}
            onChange={(e) => onChange({ ...character, customNote: e.target.value })}
          />
          <p className="character-setup__note-count">{character.customNote.length}/120</p>
        </section>
      </div>
    </>
  );
}

export default CharacterSetup;
