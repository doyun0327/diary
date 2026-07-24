import { useCallback, useEffect, useState } from 'react';
import type { RoomDetail, RoomPost } from '../types/room';
import { MOOD_MAP } from '../types/diary';
import { formatDate } from '../utils/date';
import * as roomsApi from '../api/roomsApi';
import './RoomsPages.css';

interface RoomPageProps {
  roomId: string;
  onBack: () => void;
  onOpenPost: (postId: string) => void;
}

function RoomPage({ roomId, onBack, onOpenPost }: RoomPageProps) {
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, feed] = await Promise.all([
        roomsApi.getRoom(roomId),
        roomsApi.listRoomPosts(roomId),
      ]);
      setRoom(detail);
      setPosts(feed);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('초대코드를 복사하지 못했어요');
    }
  };

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button type="button" onClick={onBack}>
          ← 목록
        </button>
        <h2>{room?.name ?? '친구 방'}</h2>
        <button type="button" className="rooms__link" onClick={() => void refresh()} disabled={loading}>
          새로고침
        </button>
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && !room && <p className="rooms__muted">불러오는 중…</p>}

      {room && (
        <>
          <section className="rooms__card rooms__invite">
            <div>
              <p className="rooms__label">초대코드 (자동 발급)</p>
              <p className="rooms__code">{room.inviteCode}</p>
              <p className="rooms__hint">친구에게 이 코드를 알려 주세요</p>
            </div>
            <button type="button" className="rooms__btn" onClick={() => void copyCode()}>
              {copied ? '복사됨' : '복사'}
            </button>
          </section>

          <section className="rooms__card">
            <h3>멤버 ({room.members.length})</h3>
            <ul className="rooms__members">
              {room.members.map((m) => (
                <li key={m.clientId}>{m.nickname || '익명'}</li>
              ))}
            </ul>
          </section>

          <section className="rooms__list-wrap">
            <h3>공유된 일기</h3>
            {posts.length === 0 && (
              <p className="rooms__muted">아직 공유된 일기가 없어요. 내 일기에서 「방에 공유」를 눌러 보세요.</p>
            )}
            <ul className="rooms__feed">
              {posts.map((post) => (
                <li key={post.id}>
                  <button type="button" className="rooms__feed-item" onClick={() => onOpenPost(post.id)}>
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt="" className="rooms__feed-thumb" />
                    )}
                    <div className="rooms__feed-body">
                      <p className="rooms__feed-author">{post.authorNickname}</p>
                      <p className="rooms__feed-title">
                        {MOOD_MAP[post.mood]?.emoji ?? ''} {post.title || formatDate(post.date)}
                      </p>
                      <p className="rooms__feed-snippet">{post.content || formatDate(post.date)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export default RoomPage;
