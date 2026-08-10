import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomDetail, RoomPost } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import RoomDiaryPaper from '../components/RoomDiaryPaper';
import {
  isRoomCommentCoachSeen,
  markRoomCommentCoachSeen,
} from '../utils/onboarding';
import './RoomsPages.css';

interface RoomPageProps {
  roomId: string;
  onBack: () => void;
  onOpenPost: (postId: string) => void;
}

function RoomPage({ roomId, onBack, onOpenPost }: RoomPageProps) {
  const { t } = useTranslation();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCoach, setShowCoach] = useState(() => !isRoomCommentCoachSeen());

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

  const dismissCoach = () => {
    markRoomCommentCoachSeen();
    setShowCoach(false);
  };

  const handleOpenPost = (postId: string) => {
    if (showCoach) dismissCoach();
    onOpenPost(postId);
  };

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
        <div className="rooms__toolbar-actions">
          {room && (
            <button
              type="button"
              className="rooms__invite-quiet"
              onClick={() => void copyCode()}
              title={t('rooms.copyInviteTitle')}
              aria-label={t('rooms.copyInviteAria')}
            >
              {copied ? t('rooms.copied') : t('rooms.copyInvite')}
            </button>
          )}
          <button type="button" className="rooms__link" onClick={() => void refresh()} disabled={loading}>
            {t('rooms.refresh')}
          </button>
        </div>
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && !room && <p className="rooms__muted">{t('common.loading')}</p>}

      {room && (
        <section className="rooms__list-wrap">
          <div className="rooms__section-head">
            <h3>{t('rooms.sharedDiaries')}</h3>
            {posts.length > 0 && (
              <span className="rooms__section-count">{posts.length}</span>
            )}
          </div>
          {posts.length === 0 && (
            <p className="rooms__muted">{t('rooms.sharedEmpty')}</p>
          )}
          {posts.length > 0 && (
            <div className="rooms__coach-anchor">
              {showCoach && (
                <div className="rooms__coach" role="status">
                  <p>{t('rooms.coach.comment')}</p>
                  <button
                    type="button"
                    className="rooms__coach-dismiss"
                    aria-label={t('common.close')}
                    onClick={dismissCoach}
                  >
                    ×
                  </button>
                </div>
              )}
              <ul className="rooms__gallery">
                {posts.map((post) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      className="rooms__gallery-item"
                      onClick={() => handleOpenPost(post.id)}
                      aria-label={t('rooms.openPostAria', {
                        author: post.authorNickname,
                        title: post.title || post.date,
                      })}
                    >
                      <span className="rooms__gallery-author">{post.authorNickname}</span>
                      <RoomDiaryPaper post={post} compact />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default RoomPage;
