import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { letterAvatarDataUrl } from '../utils/letterAvatar';
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

type ProfileSetupProps = {
  initialName?: string;
  initialAvatar?: string | null;
  onComplete: (profile: { nickname: string; avatarUrl: string }) => void;
};

/** 첫 실행: 이름·사진은 선택. 없으면 익명 + 글자 아바타 */
export default function ProfileSetup({
  initialName = '',
  initialAvatar = null,
  onComplete,
}: ProfileSetupProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
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
    const nick = name.trim().slice(0, 20) || t('common.anonymous');
    const photo = avatar || letterAvatarDataUrl(nick);
    if (!photo) {
      setError(t('profileSetup.errPhoto'));
      return;
    }
    setError(null);
    onComplete({ nickname: nick, avatarUrl: photo });
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
          <button
            type="button"
            className="profile-setup__avatar"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label={t('profileSetup.pickPhotoAria')}
          >
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              <span className="profile-setup__avatar-fallback" aria-hidden>
                {initials}
              </span>
            )}
          </button>
          <button
            type="button"
            className="profile-setup__photo-btn"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? t('common.processing') : t('profileSetup.pickPhoto')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onPick(e)}
          />

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

          {error ? <p className="profile-setup__error">{error}</p> : null}

          <button type="submit" className="profile-setup__submit" disabled={busy}>
            {t('profileSetup.start')}
          </button>
        </form>
      </div>
    </div>
  );
}
