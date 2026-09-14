import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { letterAvatarDataUrl } from '../utils/letterAvatar';
import {
  PROFILE_AGE_GROUPS,
  PROFILE_GENDERS,
  type ProfileAgeGroup,
  type ProfileGender,
} from '../utils/profileDemographics';
import './ProfileSetup.css';

const MAX_EDGE = 320;
const JPEG_QUALITY = 0.82;

function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const src = String(reader.result ?? '');
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error('image'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export type ProfileSetupResult = {
  nickname: string;
  avatarUrl: string;
  gender: ProfileGender;
  ageGroup: ProfileAgeGroup;
};

type ProfileSetupProps = {
  initialName?: string;
  initialAvatar?: string | null;
  initialGender?: ProfileGender | null;
  initialAgeGroup?: ProfileAgeGroup | null;
  onComplete: (profile: ProfileSetupResult) => void;
};

/** 첫 실행: 이름·사진은 선택. 성별·연령은 필수. */
export default function ProfileSetup({
  initialName = '',
  initialAvatar = null,
  initialGender = null,
  initialAgeGroup = null,
  onComplete,
}: ProfileSetupProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [gender, setGender] = useState<ProfileGender | null>(initialGender);
  const [ageGroup, setAgeGroup] = useState<ProfileAgeGroup | null>(
    initialAgeGroup,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('profileSetup.errImage'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch {
      setError(t('profileSetup.errPhoto'));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!gender) {
      setError(t('profileSetup.errGender'));
      return;
    }
    if (!ageGroup) {
      setError(t('profileSetup.errAge'));
      return;
    }
    const nick = name.trim().slice(0, 20) || t('common.anonymous');
    const photo = avatar || letterAvatarDataUrl(nick);
    if (!photo) {
      setError(t('profileSetup.errPhoto'));
      return;
    }
    setError(null);
    onComplete({ nickname: nick, avatarUrl: photo, gender, ageGroup });
  };

  const initials = (name.trim() || t('common.anonymous')).slice(0, 1).toUpperCase();

  return (
    <div className="profile-setup" role="dialog" aria-labelledby="profile-setup-title">
      <div className="profile-setup__panel">
        <p className="profile-setup__eyebrow">{t('profileSetup.eyebrow')}</p>
        <h1 id="profile-setup-title" className="profile-setup__title">
          {t('profileSetup.title')}
        </h1>

        <form className="profile-setup__form" onSubmit={submit}>
          <div className="profile-setup__avatar">
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              <span className="profile-setup__avatar-fallback" aria-hidden>
                {initials}
              </span>
            )}
            <input
              ref={fileRef}
              className="profile-setup__file"
              type="file"
              accept="image/*"
              disabled={busy}
              aria-label={t('profileSetup.pickPhotoAria')}
              onChange={(e) => void onPick(e)}
            />
          </div>
          <button
            type="button"
            className="profile-setup__photo-btn"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? t('common.processing') : t('profileSetup.pickPhoto')}
          </button>

          <label className="profile-setup__field" htmlFor="profile-setup-name">
            <span>{t('profileSetup.nameLabel')}</span>
            <input
              id="profile-setup-name"
              type="text"
              value={name}
              maxLength={20}
              placeholder={t('profileSetup.namePlaceholder')}
              autoComplete="nickname"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </label>

          <fieldset className="profile-setup__fieldset">
            <legend>{t('profileSetup.genderLabel')}</legend>
            <div className="profile-setup__radios" role="radiogroup">
              {PROFILE_GENDERS.map((id) => (
                <label key={id} className="profile-setup__radio">
                  <input
                    type="radio"
                    name="profile-gender"
                    value={id}
                    checked={gender === id}
                    onChange={() => {
                      setGender(id);
                      setError(null);
                    }}
                  />
                  <span>{t(`profileSetup.gender.${id}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="profile-setup__fieldset">
            <legend>{t('profileSetup.ageLabel')}</legend>
            <div className="profile-setup__radios profile-setup__radios--wrap" role="radiogroup">
              {PROFILE_AGE_GROUPS.map((id) => (
                <label key={id} className="profile-setup__radio">
                  <input
                    type="radio"
                    name="profile-age"
                    value={id}
                    checked={ageGroup === id}
                    onChange={() => {
                      setAgeGroup(id);
                      setError(null);
                    }}
                  />
                  <span>{t(`profileSetup.age.${id}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error ? <p className="profile-setup__error">{error}</p> : null}

          <button type="submit" className="profile-setup__submit" disabled={busy}>
            {t('profileSetup.start')}
          </button>
        </form>
      </div>
    </div>
  );
}
