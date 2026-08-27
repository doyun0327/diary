import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import * as roomsApi from '../api/roomsApi';
import AppModal from './AppModal';
import CloseIcon from './CloseIcon';
import {
  useAuthSession,
  type AuthSession,
} from '../hooks/useAuthSession';
import { requestNativeGoogleSignIn, nativeGoogleSignOut } from '../lib/googleAuth';
import { isFlutterApp } from '../utils/nativeShare';
import './AccountSheet.css';

interface AccountSheetProps {
  nickname: string;
  avatarUrl: string | null;
  clientId: string;
  onNicknameChange: (name: string) => void;
  onAvatarChange: (dataUrl: string | null) => void;
  /** 서버와 일기 동기화. lastSyncedAt(since) 전달 */
  onSyncDiaries: (since: string | null) => Promise<{ serverTime: string; entryCount: number }>;
  /** 탈퇴 시 이 기기 로컬 일기 비우기 */
  onClearLocalDiaries?: () => void;
  onClose: () => void;
  /** 네이티브 Google 로그인 후 시트 다시 열기 */
  onRequestReopen?: () => void;
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

// function formatSyncedAt(iso: string | null, locale: string, neverLabel: string): string {
//   if (!iso) return neverLabel;
//   try {
//     return new Intl.DateTimeFormat(locale, {
//       dateStyle: 'medium',
//       timeStyle: 'short',
//     }).format(new Date(iso));
//   } catch {
//     return iso;
//   }
// }

/** 마지막 동기화: YYYY-MM-DD HH:MM:SS (24시간) */
function formatLastSyncedAt(iso: string | null, neverLabel: string): string {
  if (!iso) return neverLabel;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return neverLabel;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const se = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${mi}:${se}`;
}

function AccountSheet({
  nickname,
  avatarUrl,
  clientId,
  onNicknameChange,
  onAvatarChange,
  onSyncDiaries,
  onClearLocalDiaries,
  onClose,
  onRequestReopen,
}: AccountSheetProps) {
  const { t } = useTranslation();
  const { session, signInWithGoogleIdToken, signOut, deleteAccount, markSynced, ensureGuestSession } =
    useAuthSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const googleHostRef = useRef<HTMLDivElement>(null);
  const onGoogleTokenRef = useRef<(idToken: string) => void>(() => {});
  const [nameDraft, setNameDraft] = useState(nickname);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState<'google' | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [flutterNative, setFlutterNative] = useState(() => isFlutterApp());
  /** 게스트 사진이 있을 때 Google 사진으로 바꿀지 묻는 대기 URL */
  const [pendingGooglePhoto, setPendingGooglePhoto] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('picture-diary-pending-google-photo');
    } catch {
      return null;
    }
  });
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement>(null);

  /** Google 클라우드만 “로그인됨”으로 취급 (게스트는 친구 방용) */
  const cloudSignedIn = session?.provider === 'google';

  useEffect(() => {
    setNameDraft(nickname);
  }, [nickname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (photoMenuOpen) {
        setPhotoMenuOpen(false);
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, photoMenuOpen]);

  useEffect(() => {
    if (!photoMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = avatarWrapRef.current;
      if (root && !root.contains(e.target as Node)) {
        setPhotoMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [photoMenuOpen]);

  const finishGoogleSignIn = async (idToken: string) => {
    setAuthBusy('google');
    setAuthError(null);
    try {
      const next = await signInWithGoogleIdToken(idToken);
      seedProfileFromAuth(next);
      try {
        const result = await onSyncDiaries(null);
        markSynced(result.serverTime);
      } catch {
        // 로컬 로그인만 된 경우
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : t('account.sync.errSignIn'));
    } finally {
      setAuthBusy(null);
    }
  };

  onGoogleTokenRef.current = (idToken: string) => {
    void finishGoogleSignIn(idToken);
  };

  useEffect(() => {
    const sync = () => {
      if (isFlutterApp()) setFlutterNative(true);
    };
    sync();
    const timer = window.setInterval(sync, 400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cloudSignedIn) {
      setGoogleReady(false);
      return;
    }
    if (flutterNative) {
      setGoogleReady(true);
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
  }, [cloudSignedIn, flutterNative]);

  const googleErrorMessage = (reason: string) => {
    if (reason === 'cancelled') return null;
    if (reason === 'developer_error') return t('account.sync.errGoogleDeveloper');
    if (reason === 'play_services') return t('account.sync.errGooglePlay');
    if (reason === 'network') return t('account.sync.errGoogleNetwork');
    if (reason === 'no_id_token') return t('account.sync.errGoogleToken');
    if (reason === 'timeout') return t('account.sync.errGoogleNative');
    return t('account.sync.errGoogleNative');
  };

  const handleNativeGoogle = () => {
    if (authBusy) return;
    // 최신 프로필 값 (시트 닫힌 뒤 클로저용)
    const nickNow = nickname;
    const avatarNow = avatarUrl;
    const nameNow = nameDraft.trim() || nickNow;
    setAuthError(null);
    setAuthBusy('google');

    // 클릭 제스처 안에서 즉시 네이티브 호출 (지연·동적 import 하면 계정창이 안 뜸)
    const signInPromise = requestNativeGoogleSignIn();
    // 네이티브 화면이 보이도록 시트만 닫기
    onClose();

    void (async () => {
      try {
        const idToken = await signInPromise;
        const next = await signInWithGoogleIdToken(idToken);
        const name = next.displayName.trim();
        if (name && !nickNow.trim()) {
          onNicknameChange(name);
          syncProfileToRooms({
            nickname: name,
            avatarUrl: next.photoUrl ?? avatarNow,
          });
        }
        if (next.photoUrl) {
          if (!avatarNow) {
            onAvatarChange(next.photoUrl);
            syncProfileToRooms({
              nickname: name || nameNow,
              avatarUrl: next.photoUrl,
            });
          } else if (next.photoUrl !== avatarNow) {
            try {
              sessionStorage.setItem(
                'picture-diary-pending-google-photo',
                next.photoUrl,
              );
            } catch {
              // ignore
            }
          }
        }
        try {
          const result = await onSyncDiaries(null);
          markSynced(result.serverTime);
        } catch {
          // 로컬 로그인만 된 경우
        }
        onRequestReopen?.();
      } catch (err) {
        const reason = err instanceof Error ? err.message : '';
        const message = googleErrorMessage(reason);
        if (message) {
          window.alert(message);
        }
        console.warn('[google] native sign-in failed', err);
        onRequestReopen?.();
      } finally {
        setAuthBusy(null);
      }
    })();
  };

  const applyAuthPhoto = (photoUrl: string, nameHint?: string) => {
    onAvatarChange(photoUrl);
    syncProfileToRooms({
      nickname: nameHint || nameDraft.trim() || nickname,
      avatarUrl: photoUrl,
    });
  };

  /** 로그인 성공후: 빈 이름만 채우고, 사진은 없을 때 시드 / 있으면 교체 확인 */
  const seedProfileFromAuth = (next: AuthSession) => {
    const name = next.displayName.trim();
    if (name && !nickname.trim()) {
      onNicknameChange(name);
      setNameDraft(name);
      syncProfileToRooms({ nickname: name, avatarUrl: next.photoUrl ?? avatarUrl });
    }
    if (!next.photoUrl) return;
    if (!avatarUrl) {
      applyAuthPhoto(next.photoUrl, name || nickname || nameDraft.trim());
      return;
    }
    if (next.photoUrl !== avatarUrl) {
      setPendingGooglePhoto(next.photoUrl);
    }
  };

  const handleSignOut = () => {
    signOut();
    nativeGoogleSignOut();
    // 친구 방용 게스트 세션 복구 (Google 없이도 공유 가능)
    const nick = nickname.trim() || t('common.anonymous');
    void ensureGuestSession(clientId, nick).catch(() => {
      // ignore
    });
  };

  const handleWithdraw = async () => {
    setAuthBusy('google');
    try {
      await deleteAccount();
      onClearLocalDiaries?.();
      setWithdrawOpen(false);
      const nick = nickname.trim() || t('common.anonymous');
      void ensureGuestSession(clientId, nick).catch(() => {
        // ignore
      });
    } catch {
      // 메시지 UI 없음
    } finally {
      setAuthBusy(null);
    }
  };

  const useAccountPhoto = () => {
    if (!session?.photoUrl) return;
    applyAuthPhoto(session.photoUrl);
  };

  const confirmReplaceWithGooglePhoto = () => {
    if (!pendingGooglePhoto) return;
    applyAuthPhoto(pendingGooglePhoto);
    setPendingGooglePhoto(null);
    try {
      sessionStorage.removeItem('picture-diary-pending-google-photo');
    } catch {
      // ignore
    }
  };

  const cancelReplaceWithGooglePhoto = () => {
    setPendingGooglePhoto(null);
    try {
      sessionStorage.removeItem('picture-diary-pending-google-photo');
    } catch {
      // ignore
    }
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
    setPhotoMenuOpen(false);
  };

  const openPhotoPicker = () => {
    setPhotoMenuOpen(false);
    fileRef.current?.click();
  };

  const showUseAccountPhoto =
    Boolean(cloudSignedIn && session?.photoUrl) && session?.photoUrl !== avatarUrl;

  const photoSection = (
    <section className="account-sheet__block">
      <p className="account-sheet__label">{t('account.photoLabel')}</p>
      <div className="account-sheet__avatar-row">
        <div className="account-sheet__avatar-wrap" ref={avatarWrapRef}>
          <button
            type="button"
            className={`account-sheet__avatar${photoMenuOpen ? ' is-menu-open' : ''}`}
            onClick={() => setPhotoMenuOpen((open) => !open)}
            disabled={busy}
            aria-label={t('account.changePhotoAria')}
            aria-expanded={photoMenuOpen}
            aria-haspopup="menu"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span className="account-sheet__avatar-placeholder" aria-hidden />
            )}
          </button>
          {photoMenuOpen ? (
            <div className="account-sheet__photo-menu" role="menu">
              <button
                type="button"
                className="account-sheet__btn"
                role="menuitem"
                disabled={busy}
                onClick={openPhotoPicker}
              >
                {busy ? t('common.processing') : t('account.editPhoto')}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  className="account-sheet__btn account-sheet__btn--ghost"
                  role="menuitem"
                  disabled={busy}
                  onClick={removePhoto}
                >
                  {t('account.removePhoto')}
                </button>
              ) : null}
              {showUseAccountPhoto ? (
                <button
                  type="button"
                  className="account-sheet__btn"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    useAccountPhoto();
                    setPhotoMenuOpen(false);
                  }}
                >
                  {t('account.useAccountPhoto')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {cloudSignedIn ? (
          <div className="account-sheet__avatar-actions">
            {session?.email ? (
              <p className="account-sheet__account-email">{session.email}</p>
            ) : null}
            <p className="account-sheet__account-synced">
              {t('account.sync.lastSyncedAt', {
                time: formatLastSyncedAt(
                  session?.lastSyncedAt ?? null,
                  t('account.sync.never'),
                ),
              })}
            </p>
          </div>
        ) : null}
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
      {cloudSignedIn ? (
        <div className="account-sheet__account-actions">
          <button
            type="button"
            className="account-sheet__account-action"
            disabled={authBusy !== null}
            onClick={handleSignOut}
          >
            {t('account.sync.signOut')}
          </button>
          <button
            type="button"
            className="account-sheet__account-action"
            disabled={authBusy !== null}
            onClick={() => setWithdrawOpen(true)}
          >
            {t('account.withdraw.button')}
          </button>
        </div>
      ) : null}
    </section>
  );

  return (
    <div className="account-sheet" role="dialog" aria-label={t('account.aria')}>
      <div className="account-sheet__backdrop" onClick={onClose} />
      <div className="account-sheet__panel">
        <header className="account-sheet__head">
          <h2>{t('account.title')}</h2>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        {cloudSignedIn ? (
          <>
            {photoSection}
            {nameSection}
          </>
        ) : (
          <>
            {photoSection}
            {nameSection}
            <section className="account-sheet__block">
              <p className="account-sheet__label">{t('account.sync.label')}</p>
              <div className="account-sheet__oauth">
                <div
                  className={`account-sheet__google-slot${authBusy === 'google' ? ' is-busy' : ''}${!googleReady ? ' is-loading' : ''}${flutterNative ? ' is-native' : ''}`}
                >
                  <button
                    type="button"
                    className="account-sheet__oauth-btn account-sheet__oauth-btn--google account-sheet__google-face"
                    disabled={authBusy !== null || !googleReady}
                    onClick={flutterNative ? () => handleNativeGoogle() : undefined}
                    tabIndex={flutterNative ? 0 : -1}
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
                  </button>
                  {!flutterNative ? (
                    <div
                      ref={googleHostRef}
                      className="account-sheet__google-host"
                      aria-label={t('account.sync.continueGoogle')}
                    />
                  ) : null}
                </div>
                {authError ? <p className="account-sheet__error">{authError}</p> : null}
                <p className="account-sheet__sync-note">{t('account.sync.autoNote')}</p>
              </div>
            </section>
          </>
        )}

      </div>

      {pendingGooglePhoto ? (
        <AppModal
          title={t('account.replacePhoto.title')}
          lead={t('account.replacePhoto.lead')}
          onDismiss={cancelReplaceWithGooglePhoto}
          secondaryLabel={t('common.cancel')}
          onSecondary={cancelReplaceWithGooglePhoto}
          primaryLabel={t('account.replacePhoto.confirm')}
          onPrimary={confirmReplaceWithGooglePhoto}
        >
          <div className="account-sheet__replace-preview" aria-hidden>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="account-sheet__replace-preview-img" />
            ) : null}
            <span className="account-sheet__replace-preview-arrow">→</span>
            <img
              src={pendingGooglePhoto}
              alt=""
              className="account-sheet__replace-preview-img"
            />
          </div>
        </AppModal>
      ) : null}

      {withdrawOpen ? (
        <AppModal
          title={t('account.withdraw.title')}
          lead={t('account.withdraw.lead')}
          onDismiss={() => setWithdrawOpen(false)}
          secondaryLabel={t('common.cancel')}
          onSecondary={() => setWithdrawOpen(false)}
          primaryLabel={
            authBusy ? t('common.processing') : t('account.withdraw.confirm')
          }
          primaryDanger
          onPrimary={() => {
            if (authBusy) return;
            void handleWithdraw();
          }}
        />
      ) : null}
    </div>
  );
}

export default AccountSheet;
