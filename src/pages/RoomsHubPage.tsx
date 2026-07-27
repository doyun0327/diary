import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomSummary } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import './RoomsPages.css';

interface RoomsHubPageProps {
  nickname: string;
  avatarUrl: string | null;
  onOpenRoom: (roomId: string) => void;
  onBack: () => void;
}

type SheetKind = 'create' | 'join' | null;

function RoomsHubPage({ nickname, avatarUrl, onOpenRoom, onBack }: RoomsHubPageProps) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
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
  }, []);

  const ensureNickname = () => {
    if (nickname.trim()) return true;
    setError(t('rooms.err.needNickname'));
    return false;
  };

  const openSheet = (kind: Exclude<SheetKind, null>) => {
    setError(null);
    if (!nickname.trim()) {
      setError(t('rooms.err.needNickname'));
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
    if (!ensureNickname() || busy) return;
    const name = roomName.trim();
    if (!name) {
      setError(t('rooms.err.nameRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await roomsApi.createRoom(name, nickname.trim(), avatarUrl);
      setRoomName('');
      setSheet(null);
      window.alert(t('rooms.alert.created', { code: room.inviteCode }));
      await refresh();
      onOpenRoom(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.create'));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!ensureNickname() || busy) return;
    const code = inviteCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setError(t('rooms.err.codeRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
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

  const nickLabel = nickname.trim() || t('rooms.noNickname');

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button type="button" onClick={onBack}>
          ←
        </button>
        <h2>{t('rooms.title')}</h2>
        <span />
      </div>

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
                {room.memberCount != null ? t('rooms.memberCount', { n: room.memberCount }) : t('rooms.roomFallback')}
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
              <p className="rooms__as-chip">{t('rooms.asChipCreate', { name: nickLabel })}</p>
              <p className="rooms__hint">{t('rooms.createHint')}</p>
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
    </div>
  );
}

export default RoomsHubPage;
