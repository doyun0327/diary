import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomDetail, RoomPost } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import BackIcon from '../components/BackIcon';
import PagePager from '../components/PagePager';
import RoomDiaryPaper from '../components/RoomDiaryPaper';
import RoomMemberAvatars from '../components/RoomMemberAvatars';
import {
  isRoomCommentCoachSeen,
  markRoomCommentCoachSeen,
} from '../utils/onboarding';
import {
  getCachedRoomFeed,
  setCachedRoomFeed,
} from '../utils/roomCache';
import './RoomsPages.css';

const ROOM_POSTS_PAGE_SIZE = 10;

interface RoomPageProps {
  roomId: string;
  userId?: string | null;
  onBack: () => void;
  onGoHome: () => void;
  onOpenPost: (postId: string) => void;
}

function RoomPage({ roomId, userId, onBack, onGoHome, onOpenPost }: RoomPageProps) {
  const { t } = useTranslation();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(() => !isRoomCommentCoachSeen());
  const [postsPage, setPostsPage] = useState(0);

  const postsPageCount = Math.max(1, Math.ceil(posts.length / ROOM_POSTS_PAGE_SIZE));
  const visiblePosts = useMemo(() => {
    const start = postsPage * ROOM_POSTS_PAGE_SIZE;
    return posts.slice(start, start + ROOM_POSTS_PAGE_SIZE);
  }, [posts, postsPage]);

  useEffect(() => {
    setPostsPage(0);
  }, [roomId]);

  useEffect(() => {
    if (postsPage > postsPageCount - 1) {
      setPostsPage(Math.max(0, postsPageCount - 1));
    }
  }, [postsPage, postsPageCount]);

  const refresh = useCallback(async () => {
    const cached = getCachedRoomFeed(roomId);
    if (cached) {
      setRoom(cached.room);
      setPosts(cached.posts);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [detail, feed] = await Promise.all([
        roomsApi.getRoom(roomId),
        roomsApi.listRoomPosts(roomId),
      ]);
      setRoom(detail);
      setPosts(feed);
      setCachedRoomFeed(roomId, detail, feed);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : t('rooms.err.load'));
      }
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
    <div className="rooms rooms--in-room">
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
          {posts.length > 0 && (
            <div className="rooms__section-head">
              <div className="rooms__section-head-main">
                <h3>{t('rooms.sharedDiaries')}</h3>
                <span className="rooms__section-count">{posts.length}</span>
              </div>
              <RoomMemberAvatars
                roomId={roomId}
                members={room.members}
                currentUserId={userId}
              />
            </div>
          )}
          {posts.length === 0 && (
            <div className="rooms__empty rooms__empty--share-cta">
              <p className="rooms__empty-title rooms__empty-title--multiline">
                {t('rooms.sharedEmpty')}
              </p>
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
                {visiblePosts.map((post) => (
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
              {posts.length > ROOM_POSTS_PAGE_SIZE && (
                <PagePager
                  page={postsPage}
                  pageCount={postsPageCount}
                  onPageChange={setPostsPage}
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default RoomPage;
