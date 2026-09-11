import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import type { RoomDetail, RoomPost } from '../types/room';
import BackIcon from '../components/BackIcon';
import PagePager from '../components/PagePager';
import RoomDiaryPaper from '../components/RoomDiaryPaper';
import RoomDiaryPickerSheet from '../components/RoomDiaryPickerSheet';
import RoomMemberAvatars from '../components/RoomMemberAvatars';
import {
  isRoomCommentCoachSeen,
  isRoomPokeCoachSeen,
  markRoomCommentCoachSeen,
  markRoomPokeCoachSeen,
} from '../utils/onboarding';
import {
  getCachedRoomFeed,
} from '../utils/roomCache';
import { prefetchRoomFeed } from '../utils/roomPrefetch';
import {
  isRoomPostUnread,
  markRoomPostSeen,
  syncRoomPostsSeenBaseline,
} from '../utils/roomPostSeen';
import { roomAuthorLabel } from '../utils/roomDisplay';
import {
  filterBlockedAuthorId,
  subscribeBlockedUsers,
} from '../utils/blockedUsers';
import './RoomsPages.css';

export const ROOM_POSTS_PAGE_SIZE = 10;

interface RoomPageProps {
  roomId: string;
  userId?: string | null;
  entries: DiaryEntry[];
  nickname: string;
  clientId: string;
  ensureGuestSession: (clientId: string, nickname: string) => Promise<unknown>;
  onBack: () => void;
  onGoHome: () => void;
  onOpenPost: (postId: string) => void;
}

function RoomPage({
  roomId,
  userId,
  entries,
  nickname,
  clientId,
  ensureGuestSession,
  onBack,
  onGoHome,
  onOpenPost,
}: RoomPageProps) {
  const { t } = useTranslation();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(() => !isRoomCommentCoachSeen());
  const [showPokeCoach, setShowPokeCoach] = useState(() => !isRoomPokeCoachSeen());
  const [postsPage, setPostsPage] = useState(0);
  const [seenTick, setSeenTick] = useState(0);
  const [blockTick, setBlockTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => subscribeBlockedUsers(() => setBlockTick((n) => n + 1)), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleFeedPosts = useMemo(() => {
    void blockTick;
    return filterBlockedAuthorId(posts);
  }, [posts, blockTick]);

  const postsPageCount = Math.max(1, totalPages);

  const feedSharedDiaryIds = useMemo(() => {
    if (!userId) return [] as string[];
    return posts
      .filter((p) => p.authorUserId === userId && p.diaryId?.trim())
      .map((p) => p.diaryId);
  }, [posts, userId]);

  const unreadPostIds = useMemo(() => {
    void seenTick;
    return new Set(
      visibleFeedPosts.filter((p) => isRoomPostUnread(roomId, p.id)).map((p) => p.id),
    );
  }, [visibleFeedPosts, roomId, seenTick]);

  useEffect(() => {
    setPostsPage(0);
    setPickerOpen(false);
    const warm = getCachedRoomFeed(roomId, 0, ROOM_POSTS_PAGE_SIZE, {
      allowStale: true,
    });
    if (warm) {
      const nextPosts = Array.isArray(warm.posts) ? warm.posts : [];
      setRoom(warm.room);
      setPosts(nextPosts);
      setTotalElements(warm.totalElements);
      setTotalPages(Math.max(1, warm.totalPages));
      setLoading(false);
    } else {
      setRoom(null);
      setPosts([]);
      setTotalElements(0);
      setTotalPages(1);
      setLoading(true);
    }
  }, [roomId]);

  useEffect(() => {
    if (postsPage > postsPageCount - 1) {
      setPostsPage(Math.max(0, postsPageCount - 1));
    }
  }, [postsPage, postsPageCount]);

  const applyFeed = useCallback(
    (cached: NonNullable<ReturnType<typeof getCachedRoomFeed>>) => {
      const nextPosts = Array.isArray(cached.posts) ? cached.posts : [];
      setRoom(cached.room);
      setPosts(nextPosts);
      setTotalElements(cached.totalElements);
      setTotalPages(Math.max(1, cached.totalPages));
      syncRoomPostsSeenBaseline(
        roomId,
        nextPosts.map((p) => p.id),
      );
      setSeenTick((n) => n + 1);
    },
    [roomId],
  );

  const roomRef = useRef(room);
  roomRef.current = room;

  const refresh = useCallback(async () => {
    const cached = getCachedRoomFeed(roomId, postsPage, ROOM_POSTS_PAGE_SIZE, {
      allowStale: true,
    });
    if (cached) {
      applyFeed(cached);
      setLoading(false);
    } else if (!roomRef.current) {
      setLoading(true);
    }

    setError(null);
    try {
      await prefetchRoomFeed(roomId, {
        page: postsPage,
        size: ROOM_POSTS_PAGE_SIZE,
        force: true,
      });
      const fresh = getCachedRoomFeed(roomId, postsPage, ROOM_POSTS_PAGE_SIZE, {
        allowStale: true,
      });
      if (fresh) applyFeed(fresh);
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : t('rooms.err.load'));
      }
    } finally {
      setLoading(false);
    }
  }, [roomId, postsPage, applyFeed, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSeenTick((n) => n + 1);
  }, [roomId]);

  const requestPostsPage = useCallback(
    (next: number) => {
      if (next === postsPage) return;
      if (next < 0 || next >= postsPageCount) return;
      setPostsPage(next);
    },
    [postsPage, postsPageCount],
  );

  const onFeedTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onFeedTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) < 48) return;
    if (dx < 0) requestPostsPage(postsPage + 1);
    else requestPostsPage(postsPage - 1);
  };

  const dismissCoach = () => {
    markRoomCommentCoachSeen();
    setShowCoach(false);
  };

  const dismissPokeCoach = () => {
    markRoomPokeCoachSeen();
    setShowPokeCoach(false);
  };

  const handleOpenPost = (postId: string) => {
    if (showCoach) dismissCoach();
    markRoomPostSeen(roomId, postId);
    setSeenTick((n) => n + 1);
    onOpenPost(postId);
  };

  const openPicker = () => setPickerOpen(true);

  const otherMembers =
    room?.members.filter((m) => !userId || m.userId !== userId) ?? [];
  const canShowPokeCoach = showPokeCoach && otherMembers.length > 0;

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
        <button
          type="button"
          className="rooms__toolbar-action"
          onClick={openPicker}
          aria-label={t('rooms.shareDiary')}
        >
          {t('rooms.shareDiary')}
        </button>
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && !room && <p className="rooms__muted">{t('common.loading')}</p>}

      {room && (
        <section className="rooms__list-wrap">
          <div className="rooms__section-head">
            <div className="rooms__section-head-main">
              <h3>{t('rooms.sharedDiaries')}</h3>
              <span className="rooms__section-count">{totalElements}</span>
            </div>
            <RoomMemberAvatars
              roomId={roomId}
              members={room.members}
              currentUserId={userId}
              showPokeCoach={canShowPokeCoach}
              onDismissPokeCoach={dismissPokeCoach}
            />
          </div>
          {loading && (
            <p className="rooms__muted">{t('common.loading')}</p>
          )}
          {!loading && visibleFeedPosts.length === 0 && (
            <div className="rooms__empty rooms__empty--share-cta">
              <p className="rooms__empty-title rooms__empty-title--multiline">
                {totalElements === 0
                  ? t('rooms.sharePrompt')
                  : t('rooms.safety.feedEmptyBlocked')}
              </p>
              {totalElements === 0 ? (
                <>
                  <button
                    type="button"
                    className="rooms__btn primary"
                    onClick={openPicker}
                  >
                    {t('rooms.shareDiary')}
                  </button>
                  <button
                    type="button"
                    className="rooms__btn rooms__btn--ghost"
                    onClick={onGoHome}
                  >
                    {t('rooms.goHome')}
                  </button>
                </>
              ) : null}
            </div>
          )}
          {!loading && visibleFeedPosts.length > 0 && (
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
              <div
                className="rooms__feed-stage"
                data-no-swipe
                onTouchStart={onFeedTouchStart}
                onTouchEnd={onFeedTouchEnd}
              >
                <div className="rooms__feed-page">
                  <ul className="rooms__gallery">
                    {visibleFeedPosts.map((post) => {
                      const author = room.members.find((m) => m.userId === post.authorUserId);
                      const withdrawn = Boolean(post.authorWithdrawn || author?.withdrawn);
                      const authorName = roomAuthorLabel(
                        author?.nickname || post.authorNickname,
                        withdrawn,
                        t,
                      );
                      const avatarUrl = withdrawn ? '' : author?.avatarUrl?.trim() || '';
                      const initial = (authorName || '?').slice(0, 1).toUpperCase();
                      const isOwnPost = Boolean(userId && post.authorUserId === userId);
                      const showNew = !isOwnPost && unreadPostIds.has(post.id);
                      return (
                      <li key={post.id}>
                        <button
                          type="button"
                          className="rooms__gallery-item"
                          onClick={() => handleOpenPost(post.id)}
                          aria-label={t('rooms.openPostAria', {
                            author: authorName,
                            title: post.title || post.date,
                          })}
                        >
                          <span className="rooms__gallery-author">
                            <span className="rooms__gallery-avatar" aria-hidden>
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="" />
                              ) : (
                                <span className="rooms__gallery-initial">{initial}</span>
                              )}
                            </span>
                            <span className="rooms__gallery-name">{authorName}</span>
                          </span>
                          <span className="rooms__gallery-body">
                            <RoomDiaryPaper post={post} compact />
                            {showNew ? (
                              <span
                                className="rooms__gallery-new"
                                aria-label={t('rooms.postNewAria')}
                              >
                                {t('rooms.postNew')}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              {postsPageCount > 1 && (
                <PagePager
                  page={postsPage}
                  pageCount={postsPageCount}
                  onPageChange={requestPostsPage}
                />
              )}
            </div>
          )}
        </section>
      )}

      {pickerOpen && room && (
        <RoomDiaryPickerSheet
          roomId={roomId}
          roomName={room.name}
          feedSharedDiaryIds={feedSharedDiaryIds}
          entries={entries}
          nickname={nickname}
          clientId={clientId}
          ensureGuestSession={ensureGuestSession}
          onClose={() => setPickerOpen(false)}
          onShared={() => {
            setToast(t('rooms.shareDiaryDone'));
            void refresh();
          }}
        />
      )}

      {toast && (
        <div className="rooms__toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default RoomPage;
