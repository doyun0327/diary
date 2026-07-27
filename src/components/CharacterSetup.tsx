import {
  GENDER_OPTIONS,
  HAIR_STYLE_OPTIONS,
  OUTFIT_OPTIONS,
  type CharacterProfile,
} from '../types/character';
import { HairStyleIcon } from './CharacterIcons';
import './CharacterSetup.css';

interface CharacterSetupProps {
  character: CharacterProfile;
  onChange: (next: CharacterProfile) => void;
  onClose: () => void;
}

const GENDER_EMOJI: Record<CharacterProfile['gender'], string> = {
  boy: '👦',
  girl: '👧',
};

function CharacterSetup({ character, onChange, onClose }: CharacterSetupProps) {
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
        <p className="character-setup__desc">이 모습이 AI 그림 속 주인공이 돼요</p>

        <section>
          <h3>누구인가요?</h3>
          <div className="character-setup__emoji-row">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`character-setup__emoji-btn character-setup__emoji-btn--labeled ${character.gender === opt.value ? 'selected' : ''}`}
                onClick={() => onChange({ ...character, gender: opt.value })}
                aria-label={opt.label}
                title={opt.label}
              >
                <span className="character-setup__emoji">{GENDER_EMOJI[opt.value]}</span>
                <span className="character-setup__emoji-caption">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>머리</h3>
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
                <HairStyleIcon style={opt.value} />
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
      </div>
    </>
  );
}

export default CharacterSetup;
