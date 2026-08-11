import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomDetail, RoomPost } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import BackIcon from '../components/BackIcon';
import RoomDiaryPaper from '../components/RoomDiaryPaper';
import {
  isRoomCommentCoachSeen,
  markRoomCommentCoachSeen,
} from '../utils/onboarding';
import './RoomsPages.css';

interface RoomPageProps {
  roomId: string;
  onBack: () => void;
  onGoHome: () => void;
  onOpenPost: (postId: string) => void;
}

function RoomPage({ roomId, onBack, onGoHome, onOpenPost }: RoomPageProps) {
  const { t } = useTranslation();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button
          type="button"
          className="rooms__back"
          onClick={onBack}
          aria-label={t('rooms.backToListAria')}
        >
          <BackIcon />
        </button>
        <h2>{room?.name ?? t('rooms.title')}</h2>
        <span className="rooms__toolbar-balance" aria-hidden />
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
            <div className="rooms__empty rooms__empty--share-cta">
              <p className="rooms__empty-title">{t('rooms.sharePrompt')}</p>
              <p className="rooms__muted">{t('rooms.sharedEmpty')}</p>
              <button type="button" className="rooms__btn primary" onClick={onGoHome}>
                {t('rooms.goHome')}
              </button>
            </div>
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
