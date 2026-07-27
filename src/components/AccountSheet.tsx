import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import * as roomsApi from '../api/roomsApi';
import LanguageSwitcher from './LanguageSwitcher';
import './AccountSheet.css';

interface AccountSheetProps {
  nickname: string;
  avatarUrl: string | null;
  onNicknameChange: (name: string) => void;
  onAvatarChange: (dataUrl: string | null) => void;
  onClose: () => void;
}

const MAX_EDGE = 320;
const JPEG_QUALITY = 0.82;

/** 프로필용으로 작게 리사이즈해 data URL로 */
function fileToAvatarDataUrl(file: File, t: (key: string) => string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('account.err.photoRead')));
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
          reject(new Error(t('account.err.photoProcess')));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error(t('account.err.photoLoad')));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** 서버에 프로필 반영 (엔드포인트 없으면 무시) */
function syncProfileToRooms(patch: { nickname?: string; avatarUrl?: string | null }) {
  void roomsApi.updateMyProfile(patch).catch(() => {
    // 백엔드 미구현·오프라인 시 로컬만 유지
  });
}

function AccountSheet({
  nickname,
  avatarUrl,
  onNicknameChange,
  onAvatarChange,
  onClose,
}: AccountSheetProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState(nickname);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNameDraft(nickname);
  }, [nickname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveName = () => {
    const name = nameDraft.trim();
    if (!name) {
      setMsg(t('account.err.nameRequired'));
      return;
    }
    onNicknameChange(name);
    syncProfileToRooms({ nickname: name, avatarUrl });
    setMsg(t('account.ok.nameSaved'));
  };

  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg(t('account.err.imageOnly'));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file, t);
      onAvatarChange(dataUrl);
      syncProfileToRooms({
        nickname: nameDraft.trim() || nickname,
        avatarUrl: dataUrl,
      });
      setMsg(t('account.ok.photoSaved'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('account.err.photoSave'));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    onAvatarChange(null);
    syncProfileToRooms({
      nickname: nameDraft.trim() || nickname,
      avatarUrl: null,
    });
    setMsg(t('account.ok.photoRemoved'));
  };

  return (
    <div className="account-sheet" role="dialog" aria-label={t('account.aria')}>
      <div className="account-sheet__backdrop" onClick={onClose} />
      <div className="account-sheet__panel">
        <header className="account-sheet__head">
          <h2>{t('account.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            {t('common.close')}
          </button>
        </header>

        <section className="account-sheet__block">
          <p className="account-sheet__label">{t('account.photoLabel')}</p>
          <div className="account-sheet__avatar-row">
            <button
              type="button"
              className="account-sheet__avatar"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              aria-label={t('account.changePhotoAria')}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span className="account-sheet__avatar-placeholder" aria-hidden>
                  {nameDraft.trim().slice(0, 1) || '?'}
                </span>
              )}
            </button>
            <div className="account-sheet__avatar-actions">
              <button
                type="button"
                className="account-sheet__btn"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? t('common.processing') : t('account.pickPhoto')}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="account-sheet__btn account-sheet__btn--ghost"
                  disabled={busy}
                  onClick={removePhoto}
                >
                  {t('account.removePhoto')}
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onPickPhoto(e)}
          />
        </section>

        <section className="account-sheet__block">
          <label className="account-sheet__label" htmlFor="account-name">
            {t('account.nameLabel')}
          </label>
          <p className="account-sheet__hint">{t('account.nameHint')}</p>
          <div className="account-sheet__name-row">
            <input
              id="account-name"
              type="text"
              value={nameDraft}
              maxLength={20}
              placeholder={t('account.namePlaceholder')}
              onChange={(e) => {
                setNameDraft(e.target.value);
                setMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveName();
                }
              }}
            />
            <button
              type="button"
              className="account-sheet__btn account-sheet__btn--solid"
              onClick={saveName}
            >
              {t('account.save')}
            </button>
          </div>
        </section>

        {msg && <p className="account-sheet__msg">{msg}</p>}

        <LanguageSwitcher variant="menu" />
      </div>
    </div>
  );
}

export default AccountSheet;
