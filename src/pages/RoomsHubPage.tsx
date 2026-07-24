import { useEffect, useState } from 'react';
import type { RoomSummary } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import './RoomsPages.css';

interface RoomsHubPageProps {
  nickname: string;
  onNicknameChange: (name: string) => void;
  onOpenRoom: (roomId: string) => void;
  onBack: () => void;
}

type JoinTab = 'create' | 'join';

function RoomsHubPage({
  nickname,
  onNicknameChange,
  onOpenRoom,
  onBack,
}: RoomsHubPageProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<JoinTab>('create');
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [nickDraft, setNickDraft] = useState(nickname);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await roomsApi.listRooms();
      setRooms(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방 목록을 불러오지 못했어요');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setNickDraft(nickname);
  }, [nickname]);

  const ensureNickname = () => {
    const name = nickDraft.trim();
    if (!name) {
      setError('친구 방에서 쓸 닉네임을 먼저 정해 주세요');
      return false;
    }
    if (name !== nickname) onNicknameChange(name);
    return true;
  };

  const openSheet = (nextTab: JoinTab = 'create') => {
    setError(null);
    setTab(nextTab);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    if (busy) return;
    setSheetOpen(false);
    setError(null);
  };

  const handleCreate = async () => {
    if (!ensureNickname() || busy) return;
    const name = roomName.trim();
    if (!name) {
      setError('방 이름을 입력해 주세요');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nick = nickDraft.trim();
      const room = await roomsApi.createRoom(name, nick);
      setRoomName('');
      setSheetOpen(false);
      window.alert(
        `방이 만들어졌어요!\n\n초대코드: ${room.inviteCode}\n\n친구에게 이 코드를 알려 주세요.`,
      );
      await refresh();
      onOpenRoom(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방을 만들지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!ensureNickname() || busy) return;
    const code = inviteCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setError('초대코드 6자리를 입력해 주세요');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nick = nickDraft.trim();
      const room = await roomsApi.joinRoom(code, nick);
      setInviteCode('');
      setSheetOpen(false);
      await refresh();
      onOpenRoom(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방에 들어가지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const saveNick = () => {
    const name = nickDraft.trim();
    if (!name) {
      setError('닉네임을 입력해 주세요');
      return;
    }
    onNicknameChange(name);
    setError(null);
  };

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button type="button" onClick={onBack}>
          ← 돌아가기
        </button>
        <h2>내 방</h2>
        <button type="button" className="rooms__link" onClick={() => void refresh()} disabled={loading}>
          새로고침
        </button>
      </div>

      <div className="rooms__nick-bar">
        <label>
          <span>닉네임</span>
          <input
            type="text"
            value={nickDraft}
            maxLength={20}
            placeholder="친구들에게 보일 이름"
            onChange={(e) => setNickDraft(e.target.value)}
            onBlur={saveNick}
          />
        </label>
        <button type="button" className="rooms__btn rooms__btn--sm" onClick={saveNick}>
          저장
        </button>
      </div>

      <button type="button" className="rooms__cta" onClick={() => openSheet('create')}>
        방 만들기 · 입장
      </button>

      {!sheetOpen && error && <p className="rooms__error">{error}</p>}

      {loading && <p className="rooms__muted">불러오는 중…</p>}

      {!loading && rooms.length === 0 && (
        <div className="rooms__empty">
          <p>아직 참여한 방이 없어요</p>
          <button type="button" className="rooms__btn primary" onClick={() => openSheet('create')}>
            방 만들기 · 입장
          </button>
        </div>
      )}

      <ul className="rooms__list">
        {rooms.map((room) => (
          <li key={room.id}>
            <button type="button" className="rooms__room-item" onClick={() => onOpenRoom(room.id)}>
              <span className="rooms__room-name">{room.name}</span>
              <span className="rooms__room-meta">
                코드 {room.inviteCode}
                {room.memberCount != null ? ` · ${room.memberCount}명` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {sheetOpen && (
        <div className="rooms-sheet" role="dialog" aria-label="방 만들기 · 입장">
          <div className="rooms-sheet__backdrop" onClick={closeSheet} />
          <div className="rooms-sheet__panel">
            <header className="rooms-sheet__head">
              <h3>방 만들기 · 입장</h3>
              <button type="button" onClick={closeSheet} disabled={busy}>
                닫기
              </button>
            </header>

            <div className="rooms-sheet__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'create'}
                className={tab === 'create' ? 'is-active' : ''}
                onClick={() => {
                  setTab('create');
                  setError(null);
                }}
              >
                만들기
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'join'}
                className={tab === 'join' ? 'is-active' : ''}
                onClick={() => {
                  setTab('join');
                  setError(null);
                }}
              >
                입장
              </button>
            </div>

            {tab === 'create' && (
              <div className="rooms-sheet__body">
                <p className="rooms__hint">방 이름만 정하면 초대코드 6자리가 자동으로 만들어져요.</p>
                <input
                  type="text"
                  value={roomName}
                  maxLength={30}
                  placeholder="방 이름"
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <button
                  type="button"
                  className="rooms__btn primary rooms__btn--block"
                  disabled={busy}
                  onClick={() => void handleCreate()}
                >
                  {busy ? '만드는 중…' : '방 만들기'}
                </button>
              </div>
            )}

            {tab === 'join' && (
              <div className="rooms-sheet__body">
                <p className="rooms__hint">친구가 알려 준 초대코드 6자리를 입력하세요.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inviteCode}
                  maxLength={6}
                  placeholder="예: 482913"
                  onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <button
                  type="button"
                  className="rooms__btn primary rooms__btn--block"
                  disabled={busy}
                  onClick={() => void handleJoin()}
                >
                  {busy ? '입장 중…' : '입장하기'}
                </button>
              </div>
            )}

            {error && <p className="rooms__error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomsHubPage;
