import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import type { RoomDetail, RoomPost } from '../types/room';
import BackIcon from '../components/BackIcon';
import CoachBubble from '../components/CoachBubble';
import PagePager from '../components/PagePager';
import RoomDiaryPaper from '../components/RoomDiaryPaper';
import RoomDiaryPickerSheet from '../components/RoomDiaryPickerSheet';
import RoomMemberAvatars from '../components/RoomMemberAvatars';
import PlusIcon from '../components/PlusIcon';
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
import { getAccessToken } from '../hooks/useAuthSession';
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
import {
  filterHiddenReportedPosts,
  subscribeHiddenReportedPosts,
} from '../utils/hiddenReportedPosts';
import './RoomsPages.css';

export const ROOM_POSTS_PAGE_SIZE = 10;

interface RoomPageProps {
  roomId: string;
  userId?: string | null;
  entries: DiaryEntry[];
  nickname: string;
  clientId: string;
  ensureGuestSession: (
    clientId: string,
    nickname: string,
    opts?: { force?: boolean },
  ) => Promise<unknown>;
  /** Google 계정 이전 달 일기 pull (공유 피커용) */
  onPullMonthDiaries?: (month: string) => Promise<number>;
  onBack: () => void;
  onOpenPost: (postId: string) => void;
  /** 방금 공유한 일기 — 피드 카드 테두리 반짝 */
  highlightDiaryId?: string | null;
  onHighlightConsumed?: () => void;
}

function RoomPage({
  roomId,
  userId,
  entries,
  nickname,
  clientId,
  ensureGuestSession,
  onPullMonthDiaries,
  onBack,
  onOpenPost,
  highlightDiaryId = null,
  onHighlightConsumed,
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
  const [showShareCoach, setShowShareCoach] = useState(true);
  const [postsPage, setPostsPage] = useState(0);
  const [seenTick, setSeenTick] = useState(0);
  const [blockTick, setBlockTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sparkleDiaryId, setSparkleDiaryId] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const sparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sparkleArmedRef = useRef<string | null>(null);

  useEffect(() => subscribeBlockedUsers(() => setBlockTick((n) => n + 1)), []);
  useEffect(
    () => subscribeHiddenReportedPosts(() => setBlockTick((n) => n + 1)),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleFeedPosts = useMemo(() => {
    void blockTick;
    return filterHiddenReportedPosts(filterBlockedAuthorId(posts));
  }, [posts, blockTick]);

  useEffect(() => {
    if (!highlightDiaryId) return;
    sparkleArmedRef.current = null;
    setSparkleDiaryId(highlightDiaryId);
  }, [highlightDiaryId]);

  useEffect(() => {
    if (!sparkleDiaryId) {
      sparkleArmedRef.current = null;
      return;
    }
    if (sparkleArmedRef.current === sparkleDiaryId) return;
    const visible = visibleFeedPosts.some(
      (p) => p.diaryId?.trim() === sparkleDiaryId,
    );
    if (!visible) return;
    sparkleArmedRef.current = sparkleDiaryId;
    if (sparkleTimerRef.current) clearTimeout(sparkleTimerRef.current);
    sparkleTimerRef.current = setTimeout(() => {
      sparkleTimerRef.current = null;
      setSparkleDiaryId(null);
      onHighlightConsumed?.();
    }, 1600);
  }, [sparkleDiaryId, visibleFeedPosts, onHighlightConsumed]);

  useEffect(
    () => () => {
      if (sparkleTimerRef.current) clearTimeout(sparkleTimerRef.current);
    },
    [],
  );

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
      const nick = nickname.trim();
      if (nick && clientId.trim() && !getAccessToken()) {
        await ensureGuestSession(clientId, nick);
      }
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
  }, [roomId, postsPage, applyFeed, t, nickname, clientId, ensureGuestSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSeenTick((n) => n + 1);
  }, [roomId]);

  // 앱 복귀·다시 보일 때 피드·N 배지 갱신
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setSeenTick((n) => n + 1);
      void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

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

  const openPicker = () => {
    setShowShareCoach(false);
    setPickerOpen(true);
  };

  const otherMembers =
    room?.members.filter((m) => !userId || m.userId !== userId) ?? [];
  const canShowPokeCoach = showPokeCoach && otherMembers.length > 0;
  const canShowShareCoach =
    Boolean(room) && !loading && totalElements === 0 && showShareCoach;

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
        <div className="rooms__toolbar-share-wrap">
          {canShowShareCoach && (
            <CoachBubble
              className="rooms__share-coach"
              arrow="top-right"
              onDismiss={() => setShowShareCoach(false)}
            >
              <p>{t('rooms.sharePrompt')}</p>
            </CoachBubble>
          )}
          <button
            type="button"
            className={`rooms__toolbar-action rooms__toolbar-action--icon${
              canShowShareCoach ? ' is-coach' : ''
            }`}
            onClick={openPicker}
            aria-label={t('rooms.shareDiary')}
            title={t('rooms.shareDiary')}
          >
            <PlusIcon size={16} strokeWidth={2} />
          </button>
        </div>
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
              <p className="rooms__empty-title">
                {totalElements === 0
                  ? t('rooms.emptyNoDiaries')
                  : t('rooms.safety.feedEmptyBlocked')}
              </p>
            </div>
          )}
          {!loading && visibleFeedPosts.length > 0 && (
            <div className="rooms__coach-anchor">
              {showCoach && (
                <CoachBubble
                  className="rooms__coach"
                  arrow="bottom-center"
                  onDismiss={dismissCoach}
                >
                  <p>{t('rooms.coach.comment')}</p>
                </CoachBubble>
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
                        post.authorUserId === userId
                          ? nickname.trim() || post.authorNickname
                          : post.authorNickname || author?.nickname || '',
                        withdrawn,
                        t,
                      );
                      const avatarUrl = withdrawn ? '' : author?.avatarUrl?.trim() || '';
                      const initial = (authorName || '?').slice(0, 1).toUpperCase();
                      const isOwnPost = Boolean(userId && post.authorUserId === userId);
                      const showNew = !isOwnPost && unreadPostIds.has(post.id);
                      const isJustShared =
                        Boolean(sparkleDiaryId) &&
                        post.diaryId?.trim() === sparkleDiaryId;
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
                          <span
                            className={`rooms__gallery-body${
                              isJustShared ? ' just-shared' : ''
                            }`}
                          >
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
          onPullMonth={onPullMonthDiaries}
          onClose={() => setPickerOpen(false)}
          onShared={(diaryId) => {
            setToast(t('rooms.shareDiaryDone', { name: room.name }));
            sparkleArmedRef.current = null;
            setSparkleDiaryId(diaryId);
            if (postsPage === 0) {
              void refresh();
            } else {
              setPostsPage(0);
            }
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
