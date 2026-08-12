import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomSummary } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import { getAccessToken } from '../hooks/useAuthSession';
import BackIcon from '../components/BackIcon';
import AppModal from '../components/AppModal';
import './RoomsPages.css';

interface RoomsHubPageProps {
  nickname: string;
  avatarUrl: string | null;
  clientId: string;
  ensureGuestSession: (clientId: string, nickname: string) => Promise<unknown>;
  onOpenAccount: () => void;
  onOpenRoom: (roomId: string) => void;
  onBack: () => void;
}

type SheetKind = 'create' | 'join' | null;

function canShare(nickname: string, avatarUrl: string | null) {
  return Boolean(nickname.trim() && avatarUrl);
}

function RoomsHubPage({
  nickname,
  avatarUrl,
  clientId,
  ensureGuestSession,
  onOpenAccount,
  onOpenRoom,
  onBack,
}: RoomsHubPageProps) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<{ id: string; inviteCode: string } | null>(null);

  const shareReady = canShare(nickname, avatarUrl);

  const ensureAuth = async () => {
    if (!shareReady) {
      throw new Error(t('rooms.err.needProfile'));
    }
    if (getAccessToken()) return;
    try {
      await ensureGuestSession(clientId, nickname.trim());
    } catch {
      throw new Error(t('rooms.err.guestAuth'));
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!shareReady) {
        setRooms([]);
        return;
      }
      await ensureAuth();
      const list = await roomsApi.listRooms();
      setRooms(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.list'));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 프로필 준비될 때 다시 로드
  }, [shareReady, nickname, clientId]);

  const openSheet = (kind: Exclude<SheetKind, null>) => {
    setError(null);
    if (!shareReady) {
      setError(t('rooms.err.needProfile'));
      return;
    }
    setSheet(kind);
  };

  const closeSheet = () => {
    if (busy) return;
    setSheet(null);
    setError(null);
  };

  const handleCreate = async () => {
    if (!shareReady || busy) return;
    const name = roomName.trim();
    if (!name) {
      setError(t('rooms.err.nameRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      const room = await roomsApi.createRoom(name, nickname.trim(), avatarUrl);
      setRoomName('');
      setSheet(null);
      setCreatedRoom({ id: room.id, inviteCode: room.inviteCode });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.create'));
    } finally {
      setBusy(false);
    }
  };

  const shareCreatedCode = async () => {
    if (!createdRoom) return;
    const code = createdRoom.inviteCode;
    const text = t('rooms.alert.shareText', { code });
    const installUrl =
      (import.meta.env.VITE_APP_SHARE_URL as string | undefined)?.trim() ||
      window.location.origin;

    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // 클립보드 실패해도 공유는 진행
    }

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: t('rooms.alert.shareTitle'),
          text,
          url: installUrl,
        });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // 공유 실패 시 아래 폴백
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${installUrl}\n${code}`);
    } catch {
      setError(t('rooms.err.copy'));
    }
  };

  const dismissCreatedRoom = () => {
    setCreatedRoom(null);
  };

  const handleJoin = async () => {
    if (!shareReady || busy) return;
    const code = inviteCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setError(t('rooms.err.codeRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      const room = await roomsApi.joinRoom(code, nickname.trim(), avatarUrl);
      setInviteCode('');
      setSheet(null);
      await refresh();
      onOpenRoom(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.join'));
    } finally {
      setBusy(false);
    }
  };

  const copyRoomCode = async (roomId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(roomId);
      setTimeout(() => setCopiedId((id) => (id === roomId ? null : id)), 1500);
    } catch {
      setError(t('rooms.err.copy'));
    }
  };

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button
          type="button"
          className="rooms__back"
          onClick={onBack}
          aria-label={t('common.back')}
        >
          <BackIcon />
        </button>
        <h2>{t('rooms.title')}</h2>
        <span />
      </div>

      {!shareReady ? (
        <div className="rooms__empty">
          <p>{t('rooms.err.needProfile')}</p>
          <button type="button" className="rooms__btn primary" onClick={onOpenAccount}>
            {t('account.title')}
          </button>
        </div>
      ) : (
        <>
          <div className="rooms__actions">
            <button type="button" className="rooms__btn" onClick={() => openSheet('join')}>
              {t('rooms.joinWithCode')}
            </button>
            <button type="button" className="rooms__btn primary" onClick={() => openSheet('create')}>
              {t('rooms.create')}
            </button>
          </div>

          {!sheet && error && <p className="rooms__error">{error}</p>}

          {loading && <p className="rooms__muted">{t('common.loading')}</p>}

          {!loading && rooms.length === 0 && (
            <div className="rooms__empty">
              <p>{t('rooms.empty')}</p>
            </div>
          )}

          <ul className="rooms__list">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  className="rooms__room-item"
                  onClick={() => onOpenRoom(room.id)}
                >
                  <span className="rooms__room-name">{room.name}</span>
                  <span className="rooms__room-meta">
                    {room.memberCount != null
                      ? t('rooms.memberCount', { n: room.memberCount })
                      : t('rooms.roomFallback')}
                    <span className="rooms__meta-sep" aria-hidden>
                      ·
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rooms__invite-quiet"
                      title={t('rooms.copyInviteTitle')}
                      aria-label={t('rooms.copyInviteAria')}
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyRoomCode(room.id, room.inviteCode);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          void copyRoomCode(room.id, room.inviteCode);
                        }
                      }}
                    >
                      {copiedId === room.id ? t('rooms.copied') : t('rooms.copyInvite')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {sheet === 'create' && (
        <div className="rooms-sheet" role="dialog" aria-label={t('rooms.createSheetAria')}>
          <div className="rooms-sheet__backdrop" onClick={closeSheet} />
          <div className="rooms-sheet__panel">
            <header className="rooms-sheet__head">
              <h3>{t('rooms.create')}</h3>
              <button type="button" onClick={closeSheet} disabled={busy}>
                {t('common.close')}
              </button>
            </header>
            <div className="rooms-sheet__body">
              <input
                type="text"
                value={roomName}
                maxLength={30}
                placeholder={t('rooms.roomNamePlaceholder')}
                onChange={(e) => setRoomName(e.target.value)}
              />
              <button
                type="button"
                className="rooms__btn primary rooms__btn--block"
                disabled={busy}
                onClick={() => void handleCreate()}
              >
                {busy ? t('rooms.creating') : t('rooms.create')}
              </button>
            </div>
            {error && <p className="rooms__error">{error}</p>}
          </div>
        </div>
      )}

      {sheet === 'join' && (
        <div className="rooms-sheet" role="dialog" aria-label={t('rooms.joinSheetAria')}>
          <div className="rooms-sheet__backdrop" onClick={closeSheet} />
          <div className="rooms-sheet__panel">
            <header className="rooms-sheet__head">
              <h3>{t('rooms.joinWithCode')}</h3>
              <button type="button" onClick={closeSheet} disabled={busy}>
                {t('common.close')}
              </button>
            </header>
            <div className="rooms-sheet__body">
              <input
                type="text"
                inputMode="numeric"
                value={inviteCode}
                maxLength={6}
                placeholder={t('rooms.invitePlaceholder')}
                onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button
                type="button"
                className="rooms__btn primary rooms__btn--block"
                disabled={busy}
                onClick={() => void handleJoin()}
              >
                {busy ? t('rooms.joining') : t('rooms.joinSubmit')}
              </button>
            </div>
            {error && <p className="rooms__error">{error}</p>}
          </div>
        </div>
      )}

      {createdRoom && (
        <AppModal
          title={t('rooms.alert.createdTitle')}
          lead={t('rooms.alert.createdLead')}
          onDismiss={dismissCreatedRoom}
          closeAriaLabel={t('common.close')}
          primaryLabel={t('rooms.alert.share')}
          onPrimary={() => void shareCreatedCode()}
        >
          <p className="rooms-created__code" aria-label={t('rooms.copyInviteAria')}>
            {createdRoom.inviteCode}
          </p>
        </AppModal>
      )}
    </div>
  );
}

export default RoomsHubPage;
