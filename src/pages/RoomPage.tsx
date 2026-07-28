import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomDetail, RoomPost } from '../types/room';
import { formatDate } from '../utils/date';
import * as roomsApi from '../api/roomsApi';
import MoodIcon from '../components/MoodIcon';
import './RoomsPages.css';

interface RoomPageProps {
  roomId: string;
  clientId: string;
  myAvatarUrl: string | null;
  onBack: () => void;
  onOpenPost: (postId: string) => void;
}

function RoomPage({ roomId, clientId, myAvatarUrl, onBack, onOpenPost }: RoomPageProps) {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t('rooms.err.load'));
    } finally {
      setLoading(false);
    }
  }, [roomId, t]);

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
      setError(t('rooms.err.copy'));
    }
  };

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button type="button" onClick={onBack}>
          {t('rooms.backToList')}
        </button>
        <h2>{room?.name ?? t('rooms.title')}</h2>
        <button type="button" className="rooms__link" onClick={() => void refresh()} disabled={loading}>
          {t('rooms.refresh')}
        </button>
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && !room && <p className="rooms__muted">{t('common.loading')}</p>}

      {room && (
        <>
          <section className="rooms__card">
            <div className="rooms__card-head">
              <h3>
                {room.name}
              </h3>
              <button
                type="button"
                className="rooms__invite-quiet"
                onClick={() => void copyCode()}
                title={t('rooms.copyInviteTitle')}
                aria-label={t('rooms.copyInviteAria')}
              >
                {copied ? t('rooms.copied') : t('rooms.copyInvite')}
              </button>
            </div>
            <ul className="rooms__members">
              {room.members.map((m) => {
                const name = m.nickname || t('common.anonymous');
                const photo =
                  (m.clientId === clientId ? myAvatarUrl : null) || m.avatarUrl || null;
                return (
                  <li key={m.clientId} className="rooms__member">
                    <span className="rooms__member-avatar" aria-hidden>
                      {photo ? (
                        <img src={photo} alt="" />
                      ) : (
                        <span>{name.slice(0, 1)}</span>
                      )}
                    </span>
                    <span className="rooms__member-name">{name}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rooms__list-wrap">
            <h3>{t('rooms.sharedDiaries')}</h3>
            {posts.length === 0 && (
              <p className="rooms__muted">{t('rooms.sharedEmpty')}</p>
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
                        {post.mood ? <MoodIcon mood={post.mood} size={16} /> : null}{' '}
                        {post.title || formatDate(post.date)}
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
