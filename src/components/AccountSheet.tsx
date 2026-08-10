import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import * as roomsApi from '../api/roomsApi';
import {
  useAuthSession,
  type AuthProvider,
  type AuthSession,
} from '../hooks/useAuthSession';
import './AccountSheet.css';

interface AccountSheetProps {
  nickname: string;
  avatarUrl: string | null;
  onNicknameChange: (name: string) => void;
  onAvatarChange: (dataUrl: string | null) => void;
  /** 서버와 일기 동기화. lastSyncedAt(since) 전달 */
  onSyncDiaries: (since: string | null) => Promise<{ serverTime: string; entryCount: number }>;
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

function formatSyncedAt(iso: string | null, locale: string, neverLabel: string): string {
  if (!iso) return neverLabel;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function AccountSheet({
  nickname,
  avatarUrl,
  onNicknameChange,
  onAvatarChange,
  onSyncDiaries,
  onClose,
}: AccountSheetProps) {
  const { t, i18n } = useTranslation();
  const { session, signIn, signOut, markSynced } = useAuthSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState(nickname);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState<AuthProvider | null>(null);

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

  /** 로그인 직후: 빈 이름만 채우고, 사진은 없을 때만 계정 사진 시드 */
  const seedProfileFromAuth = (next: AuthSession) => {
    const name = next.displayName.trim();
    if (name && !nickname.trim()) {
      onNicknameChange(name);
      setNameDraft(name);
      syncProfileToRooms({ nickname: name, avatarUrl: next.photoUrl ?? avatarUrl });
    }
    if (next.photoUrl && !avatarUrl) {
      onAvatarChange(next.photoUrl);
      syncProfileToRooms({
        nickname: name || nickname || nameDraft.trim(),
        avatarUrl: next.photoUrl,
      });
    }
  };

  const handleSignIn = async (provider: AuthProvider) => {
    setAuthBusy(provider);
    setMsg(null);
    try {
      const next = await signIn(provider);
      seedProfileFromAuth(next);
      try {
      const result = await onSyncDiaries(null);
        markSynced(result.serverTime);
        setMsg(t('account.sync.okSignedInSynced'));
      } catch {
        setMsg(t('account.sync.okSignedIn'));
      }
    } catch {
      setMsg(t('account.sync.errSignIn'));
    } finally {
      setAuthBusy(null);
    }
  };

  const handleSignOut = () => {
    signOut();
    setMsg(t('account.sync.okSignedOut'));
  };

  const useAccountPhoto = () => {
    if (!session?.photoUrl) {
      setMsg(t('account.sync.noAccountPhoto'));
      return;
    }
    onAvatarChange(session.photoUrl);
    syncProfileToRooms({
      nickname: nameDraft.trim() || nickname,
      avatarUrl: session.photoUrl,
    });
    setMsg(t('account.ok.photoSaved'));
  };

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

  const providerLabel =
    session?.provider === 'apple'
      ? t('account.sync.providerApple')
      : t('account.sync.providerGoogle');

  const syncedLabel = formatSyncedAt(
    session?.lastSyncedAt ?? null,
    i18n.language,
    t('account.sync.never'),
  );

  const showUseAccountPhoto =
    Boolean(session?.photoUrl) && session?.photoUrl !== avatarUrl;

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
          <p className="account-sheet__label">{t('account.sync.label')}</p>
          <p className="account-sheet__hint">{t('account.sync.hint')}</p>

          {session ? (
            <div className="account-sheet__sync">
              <div className="account-sheet__sync-card">
                <span className="account-sheet__sync-provider">{providerLabel}</span>
                <strong className="account-sheet__sync-email">{session.email}</strong>
                <span className="account-sheet__sync-meta">
                  {t('account.sync.lastSynced', { time: syncedLabel })}
                </span>
              </div>
              <div className="account-sheet__sync-actions">
                <button
                  type="button"
                  className="account-sheet__btn account-sheet__btn--ghost"
                  disabled={authBusy !== null}
                  onClick={handleSignOut}
                >
                  {t('account.sync.signOut')}
                </button>
              </div>
              <p className="account-sheet__sync-note">{t('account.sync.autoNote')}</p>
            </div>
          ) : (
            <div className="account-sheet__oauth">
              <button
                type="button"
                className="account-sheet__oauth-btn account-sheet__oauth-btn--google"
                disabled={authBusy !== null}
                onClick={() => void handleSignIn('google')}
              >
                {authBusy === 'google'
                  ? t('account.sync.signingIn')
                  : t('account.sync.continueGoogle')}
              </button>
              <button
                type="button"
                className="account-sheet__oauth-btn account-sheet__oauth-btn--apple"
                disabled={authBusy !== null}
                onClick={() => void handleSignIn('apple')}
              >
                {authBusy === 'apple'
                  ? t('account.sync.signingIn')
                  : t('account.sync.continueApple')}
              </button>
              <p className="account-sheet__sync-note">{t('account.sync.autoNote')}</p>
            </div>
          )}
        </section>

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
              {showUseAccountPhoto && (
                <button
                  type="button"
                  className="account-sheet__btn"
                  disabled={busy}
                  onClick={useAccountPhoto}
                >
                  {t('account.useAccountPhoto')}
                </button>
              )}
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
          <p className="account-sheet__hint">
            {session ? t('account.nameHintLoggedIn') : t('account.nameHint')}
          </p>
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
      </div>
    </div>
  );
}

export default AccountSheet;
