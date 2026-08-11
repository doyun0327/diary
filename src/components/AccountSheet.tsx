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
  clientId: string;
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
  clientId,
  onNicknameChange,
  onAvatarChange,
  onSyncDiaries,
  onClose,
}: AccountSheetProps) {
  const { t, i18n } = useTranslation();
  const { session, signIn, signInWithGoogleIdToken, signOut, markSynced, ensureGuestSession } =
    useAuthSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const googleHostRef = useRef<HTMLDivElement>(null);
  const onGoogleTokenRef = useRef<(idToken: string) => void>(() => {});
  const [nameDraft, setNameDraft] = useState(nickname);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState<AuthProvider | null>(null);
  const [googleReady, setGoogleReady] = useState(false);

  /** Google 클라우드만 “로그인됨”으로 취급 (게스트는 친구 방용) */
  const cloudSignedIn = session?.provider === 'google';

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

  const finishGoogleSignIn = async (idToken: string) => {
    setAuthBusy('google');
    try {
      const next = await signInWithGoogleIdToken(idToken);
      seedProfileFromAuth(next);
      try {
        const result = await onSyncDiaries(null);
        markSynced(result.serverTime);
      } catch {
        // 로컬 로그인만 된 경우
      }
    } catch {
      // 메시지 UI 없음
    } finally {
      setAuthBusy(null);
    }
  };

  onGoogleTokenRef.current = (idToken: string) => {
    void finishGoogleSignIn(idToken);
  };

  useEffect(() => {
    if (cloudSignedIn) {
      setGoogleReady(false);
      return;
    }
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!googleClientId) return;

    const host = googleHostRef.current;
    if (!host) return;

    const ac = new AbortController();
    let dispose: (() => void) | undefined;

    void import('../lib/googleAuth')
      .then(({ mountGoogleSignInButton }) =>
        mountGoogleSignInButton(
          host,
          googleClientId,
          (idToken) => {
            onGoogleTokenRef.current(idToken);
          },
          ac.signal,
        ),
      )
      .then((cleanup) => {
        if (ac.signal.aborted) {
          cleanup();
          return;
        }
        dispose = cleanup;
        setGoogleReady(true);
      })
      .catch(() => {
        // 메시지 UI 없음
      });

    return () => {
      ac.abort();
      dispose?.();
    };
  }, [cloudSignedIn]);

  /** 로그인 성공후: 빈 이름만 채우고, 사진은 없을 때만 계정 사진 시드 */
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
    try {
      const next = await signIn(provider);
      seedProfileFromAuth(next);
      try {
        const result = await onSyncDiaries(null);
        markSynced(result.serverTime);
      } catch {
        // 로컬 로그인만 된 경우
      }
    } catch {
      // 메시지 UI 없음
    } finally {
      setAuthBusy(null);
    }
  };

  const handleSignOut = () => {
    signOut();
    // 친구 방용 게스트 세션 복구
    if (nickname.trim() && avatarUrl) {
      void ensureGuestSession(clientId, nickname.trim()).catch(() => {
        // ignore
      });
    }
  };

  const useAccountPhoto = () => {
    if (!session?.photoUrl) return;
    onAvatarChange(session.photoUrl);
    syncProfileToRooms({
      nickname: nameDraft.trim() || nickname,
      avatarUrl: session.photoUrl,
    });
  };

  const saveName = () => {
    const name = nameDraft.trim();
    if (!name) return;
    onNicknameChange(name);
    syncProfileToRooms({ nickname: name, avatarUrl });
  };

  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file, t);
      onAvatarChange(dataUrl);
      syncProfileToRooms({
        nickname: nameDraft.trim() || nickname,
        avatarUrl: dataUrl,
      });
    } catch {
      // 메시지 UI 없음
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
  };

  const showUseAccountPhoto =
    Boolean(cloudSignedIn && session?.photoUrl) && session?.photoUrl !== avatarUrl;

  const photoSection = (
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
  );

  const nameSection = (
    <section className="account-sheet__block">
      <label className="account-sheet__label" htmlFor="account-name">
        {t('account.nameLabel')}
      </label>
     
      <div className="account-sheet__name-row">
        <input
          id="account-name"
          type="text"
          value={nameDraft}
          maxLength={20}
          placeholder={t('account.namePlaceholder')}
              onChange={(e) => {
                setNameDraft(e.target.value);
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
  );

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

        {cloudSignedIn ? (
          <>
            {photoSection}
            {nameSection}
            <section className="account-sheet__block">
              <p className="account-sheet__label">{t('account.sync.label')}</p>
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
            </section>
          </>
        ) : (
          <>
            <section className="account-sheet__block">
              <p className="account-sheet__label">{t('account.sync.label')}</p>
              <div className="account-sheet__oauth">
                <div
                  className={`account-sheet__google-slot${authBusy === 'google' ? ' is-busy' : ''}${!googleReady ? ' is-loading' : ''}`}
                >
                  <div
                    className="account-sheet__oauth-btn account-sheet__oauth-btn--google account-sheet__google-face"
                    aria-hidden
                  >
                    <span className="account-sheet__oauth-logo">
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    </span>
                    <span>
                      {authBusy === 'google'
                        ? t('account.sync.signingIn')
                        : t('account.sync.continueGoogle')}
                    </span>
                  </div>
                  <div
                    ref={googleHostRef}
                    className="account-sheet__google-host"
                    aria-label={t('account.sync.continueGoogle')}
                  />
                </div>
                <button
                  type="button"
                  className="account-sheet__oauth-btn account-sheet__oauth-btn--apple"
                  disabled={authBusy !== null}
                  onClick={() => void handleSignIn('apple')}
                >
                  <span className="account-sheet__oauth-logo account-sheet__oauth-logo--apple" aria-hidden>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M16.7 12.65c-.03-2.36 1.93-3.5 2.02-3.55-1.1-1.61-2.82-1.83-3.43-1.86-1.46-.15-2.85.86-3.59.86-.74 0-1.89-.84-3.1-.82-1.6.02-3.07.93-3.89 2.36-1.66 2.88-.42 7.14 1.19 9.48.79 1.14 1.73 2.42 2.96 2.38 1.19-.05 1.64-.76 3.08-.76 1.43 0 1.84.76 3.1.74 1.28-.02 2.09-1.16 2.87-2.31.9-1.32 1.27-2.6 1.29-2.66-.03-.01-2.47-.95-2.5-3.76zM14.4 5.95c.66-.8 1.1-1.9.98-3.01-0.95.04-2.1.63-2.78 1.43-.61.7-1.14 1.82-1 2.89 1.05.08 2.13-.54 2.8-1.31z" />
                    </svg>
                  </span>
                  <span>
                    {authBusy === 'apple'
                      ? t('account.sync.signingIn')
                      : t('account.sync.continueApple')}
                  </span>
                </button>
                <p className="account-sheet__sync-note">{t('account.sync.autoNote')}</p>
              </div>
            </section>
            {photoSection}
            {nameSection}
          </>
        )}

      </div>
    </div>
  );
}

export default AccountSheet;
