import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import type { RoomDetail, RoomPost } from '../types/room';
import BackIcon from '../components/BackIcon';
import CoachBubble from '../components/CoachBubble';
import PagePager from '../components/PagePager';
import DotsLoading from '../components/DotsLoading';
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
  getRememberedRoomFeedPage,
  rememberRoomFeedPage,
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

function pageCountFromTotal(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / ROOM_POSTS_PAGE_SIZE) || 1);
}

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(() => !isRoomCommentCoachSeen());
  const [showPokeCoach, setShowPokeCoach] = useState(() => !isRoomPokeCoachSeen());
  const [showShareCoach, setShowShareCoach] = useState(true);
  const [postsPage, setPostsPage] = useState(() => getRememberedRoomFeedPage(roomId));
  const [seenTick, setSeenTick] = useState(0);
  const [blockTick, setBlockTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sparkleDiaryId, setSparkleDiaryId] = useState<string | null>(null);
  const sparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sparkleArmedRef = useRef<string | null>(null);
  const postsPageRef = useRef(postsPage);
  const refreshSeqRef = useRef(0);
  const roomIdRef = useRef(roomId);
  const totalElementsRef = useRef(totalElements);
  totalElementsRef.current = totalElements;
  const ensureGuestSessionRef = useRef(ensureGuestSession);
  ensureGuestSessionRef.current = ensureGuestSession;
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;
  const clientIdRef = useRef(clientId);
  clientIdRef.current = clientId;

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

  // 페이지 수: totalElements 기준. 보고 있는 페이지가 페이저에서 안 사라지게 하한 유지
  const postsPageCount = Math.max(
    pageCountFromTotal(totalElements),
    postsPage + 1,
  );

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

  const applyTotalElements = useCallback((page: number, nextTotal: number) => {
    const n = Number(nextTotal);
    if (!Number.isFinite(n) || n < 0) return;
    setTotalElements((prev) => {
      // 0페이지만 줄일 수 있음. 다른 페이지 응답이 total을 깎아 1페이지로 붕괴·튕김 방지
      if (page === 0) return n;
      if (n > 0) return Math.max(prev, n);
      return prev;
    });
  }, []);

  const applyFeed = useCallback(
    (cached: NonNullable<ReturnType<typeof getCachedRoomFeed>>) => {
      if (cached.page !== postsPageRef.current) return;
      const nextPosts = Array.isArray(cached.posts) ? cached.posts : [];
      setRoom(cached.room);
      setPosts(nextPosts);
      applyTotalElements(cached.page, cached.totalElements);
      syncRoomPostsSeenBaseline(
        roomId,
        nextPosts.map((p) => p.id),
      );
      setSeenTick((n) => n + 1);
    },
    [roomId, applyTotalElements],
  );

  const goToPostsPage = useCallback(
    (next: number) => {
      const count = Math.max(
        pageCountFromTotal(totalElementsRef.current),
        postsPageRef.current + 1,
      );
      if (next < 0 || next >= count) return;
      if (next === postsPageRef.current) return;
      // 진행 중 요청 무효화 — 이전 페이지 응답이 덮어쓰지 않게
      refreshSeqRef.current += 1;
      rememberRoomFeedPage(roomId, next);
      postsPageRef.current = next;
      setPostsPage(next);

      const warm = getCachedRoomFeed(roomId, next, ROOM_POSTS_PAGE_SIZE, {
        allowStale: true,
      });
      if (warm) {
        applyFeed(warm);
        setLoading(false);
      } else {
        setLoading(true);
      }
    },
    [roomId, applyFeed],
  );

  useEffect(() => {
    const roomChanged = roomIdRef.current !== roomId;
    roomIdRef.current = roomId;
    const startPage = getRememberedRoomFeedPage(roomId);
    if (roomChanged || postsPageRef.current !== startPage) {
      postsPageRef.current = startPage;
      setPostsPage(startPage);
    }
    setPickerOpen(false);
    refreshSeqRef.current += 1;

    const warm = getCachedRoomFeed(roomId, startPage, ROOM_POSTS_PAGE_SIZE, {
      allowStale: true,
    });
    if (warm) {
      const nextPosts = Array.isArray(warm.posts) ? warm.posts : [];
      setRoom(warm.room);
      setPosts(nextPosts);
      applyTotalElements(warm.page, warm.totalElements);
      setLoading(false);
    } else {
      const page0 = getCachedRoomFeed(roomId, 0, ROOM_POSTS_PAGE_SIZE, {
        allowStale: true,
      });
      setRoom(page0?.room ?? null);
      setPosts([]);
      if (page0) applyTotalElements(0, page0.totalElements);
      setLoading(true);
    }
  }, [roomId, applyTotalElements]);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    const page = postsPageRef.current;
    const cached = getCachedRoomFeed(roomId, page, ROOM_POSTS_PAGE_SIZE, {
      allowStale: true,
    });
    if (cached) {
      applyFeed(cached);
      if (seq === refreshSeqRef.current) setLoading(false);
    } else if (seq === refreshSeqRef.current) {
      setLoading(true);
    }

    setError(null);
    try {
      const nick = nicknameRef.current.trim();
      const cid = clientIdRef.current.trim();
      if (nick && cid && !getAccessToken()) {
        await ensureGuestSessionRef.current(cid, nick);
      }
      if (seq !== refreshSeqRef.current) return;

      const needForce = !cached || Boolean(cached.stale);
      await prefetchRoomFeed(roomId, {
        page,
        size: ROOM_POSTS_PAGE_SIZE,
        force: needForce,
      });
      if (seq !== refreshSeqRef.current) return;
      if (postsPageRef.current !== page) return;

      const fresh = getCachedRoomFeed(roomId, page, ROOM_POSTS_PAGE_SIZE, {
        allowStale: true,
      });
      if (fresh) applyFeed(fresh);
    } catch (err) {
      if (seq !== refreshSeqRef.current) return;
      if (postsPageRef.current !== page) return;
      if (!cached) {
        setError(err instanceof Error ? err.message : t('rooms.err.load'));
      }
    } finally {
      if (seq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  }, [roomId, postsPage, applyFeed, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSeenTick((n) => n + 1);
  }, [roomId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setSeenTick((n) => n + 1);
      void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const requestPostsPage = useCallback(
    (next: number) => {
      if (loading) return;
      goToPostsPage(next);
    },
    [loading, goToPostsPage],
  );

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
      {loading && !room && (
        <div className="rooms__dots-loading">
          <DotsLoading label={t('common.loading')} />
        </div>
      )}

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
            <div className="rooms__dots-loading">
              <DotsLoading label={t('common.loading')} />
            </div>
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
              <div className="rooms__feed-stage" data-no-swipe>
                <div className="rooms__feed-page">
                  <ul className="rooms__gallery">
                    {visibleFeedPosts.map((post) => {
                      const author = room.members.find((m) => m.userId === post.authorUserId);
                      const withdrawn = Boolean(post.authorWithdrawn || author?.withdrawn);
                      const authorName = roomAuthorLabel(
                        post.authorNickname,
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
            </div>
          )}
          {postsPageCount > 1 && (
            <PagePager
              page={postsPage}
              pageCount={postsPageCount}
              onPageChange={requestPostsPage}
              disabled={loading}
            />
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
              goToPostsPage(0);
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
