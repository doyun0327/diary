import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomComment, RoomPost } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import AppModal from '../components/AppModal';
import BackIcon from '../components/BackIcon';
import RoomDiaryPaper from '../components/RoomDiaryPaper';
import RoomSafetyModal, { type SafetyTarget } from '../components/RoomSafetyModal';
import { getCachedRoomDetail, getCachedRoomPost } from '../utils/roomCache';
import { markRoomPostSeen } from '../utils/roomPostSeen';
import { roomAuthorLabel } from '../utils/roomDisplay';
import {
  filterBlockedAuthorId,
  isUserBlocked,
  subscribeBlockedUsers,
} from '../utils/blockedUsers';
import { useClientProfile } from '../hooks/useClientProfile';
import './RoomsPages.css';

interface RoomPostPageProps {
  roomId: string;
  postId: string;
  userId: string;
  onBack: () => void;
}

/** 스레드에 등장한 순서 기준 0~9 색 인덱스 */
function buildCommentColorMap(comments: RoomComment[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of comments) {
    if (!map.has(c.authorUserId)) {
      map.set(c.authorUserId, map.size % 10);
    }
  }
  return map;
}

/** 키보드와 댓글 입력칸 사이 여유(px) */
const COMMENT_KEYBOARD_GAP = 8;

function measureKeyboardCover(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = Math.max(
    0,
    Math.round(window.innerHeight - vv.height - vv.offsetTop),
  );
  return covered >= 40 ? covered : 0;
}

function RoomPostPage({ roomId, postId, userId, onBack }: RoomPostPageProps) {
  const { t } = useTranslation();
  const { nickname } = useClientProfile();
  const cachedPost = useMemo(
    () => getCachedRoomPost(roomId, postId),
    [roomId, postId],
  );
  const [post, setPost] = useState<RoomPost | null>(cachedPost);
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(!cachedPost);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [blockTick, setBlockTick] = useState(0);
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  const commentListRef = useRef<HTMLUListElement>(null);
  const commentFormRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentSpacerRef = useRef<HTMLDivElement>(null);
  const commentFocusedRef = useRef(false);
  const heightOnFocusRef = useRef(0);
  const syncKeyboardScrollRef = useRef<() => void>(() => {});

  useEffect(() => subscribeBlockedUsers(() => setBlockTick((n) => n + 1)), []);

  useEffect(() => {
    const vv = window.visualViewport;

    const syncKeyboardScroll = () => {
      if (!commentFocusedRef.current) return;
      const spacer = commentSpacerRef.current;
      const root = pageRef.current;
      const form = commentFormRef.current;
      if (!root || !form) return;

      const cover = measureKeyboardCover();
      const shrunk = Math.max(
        0,
        heightOnFocusRef.current - window.innerHeight,
      );
      const gap = COMMENT_KEYBOARD_GAP;
      // WebView가 줄어든 경우에도 gap만큼 스크롤 여유가 있어야 틈이 생김
      if (spacer) {
        if (shrunk >= 40) {
          spacer.style.height = `${gap}px`;
        } else if (cover > 0) {
          spacer.style.height = `${cover + gap}px`;
        } else {
          spacer.style.height = `${gap}px`;
        }
      }

      const alignFormToKeyboard = () => {
        if (!commentFocusedRef.current || !root || !form) return;
        const visibleBottom = vv
          ? vv.offsetTop + vv.height
          : window.innerHeight;
        const targetBottom = visibleBottom - gap;
        const delta = form.getBoundingClientRect().bottom - targetBottom;
        if (Math.abs(delta) > 0.5) root.scrollTop += delta;
      };

      alignFormToKeyboard();
      requestAnimationFrame(alignFormToKeyboard);
    };

    syncKeyboardScrollRef.current = syncKeyboardScroll;

    const onViewportChange = () => {
      if (commentFocusedRef.current) syncKeyboardScroll();
    };

    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);
    window.addEventListener('resize', onViewportChange);

    return () => {
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      commentFocusedRef.current = false;
      const spacer = commentSpacerRef.current;
      if (spacer) spacer.style.height = '0px';
    };
  }, []);

  /** 댓글이 추가돼도 입력칸은 키보드 위, 새 댓글은 위로 밀림 */
  useLayoutEffect(() => {
    if (!commentFocusedRef.current) return;
    syncKeyboardScrollRef.current();
  }, [comments.length]);

  const onCommentFocus = () => {
    commentFocusedRef.current = true;
    heightOnFocusRef.current = window.innerHeight;
    const run = () => syncKeyboardScrollRef.current();
    run();
    window.setTimeout(run, 80);
    window.setTimeout(run, 220);
    window.setTimeout(run, 400);
  };

  const onCommentBlur = (e: FocusEvent<HTMLInputElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && commentFormRef.current?.contains(next)) return;

    window.setTimeout(() => {
      if (commentFormRef.current?.contains(document.activeElement)) return;
      commentFocusedRef.current = false;
      heightOnFocusRef.current = 0;
      const spacer = commentSpacerRef.current;
      if (spacer) spacer.style.height = '0px';
    }, 120);
  };

  useEffect(() => {
    if (!post || post.authorWithdrawn) {
      setAuthorAvatarUrl('');
      return;
    }
    const fromCache = getCachedRoomDetail(roomId)
      ?.members.find((m) => m.userId === post.authorUserId)
      ?.avatarUrl?.trim();
    if (fromCache) {
      setAuthorAvatarUrl(fromCache);
      return;
    }
    let cancelled = false;
    void roomsApi
      .getRoom(roomId)
      .then((detail) => {
        if (cancelled) return;
        const url =
          detail.members
            .find((m) => m.userId === post.authorUserId)
            ?.avatarUrl?.trim() || '';
        setAuthorAvatarUrl(url);
      })
      .catch(() => {
        if (!cancelled) setAuthorAvatarUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [post, roomId]);

  const visibleComments = useMemo(() => {
    void blockTick;
    return filterBlockedAuthorId(comments);
  }, [comments, blockTick]);

  const colorMap = useMemo(
    () => buildCommentColorMap(visibleComments),
    [visibleComments],
  );

  const refresh = useCallback(async () => {
    const fromCache = getCachedRoomPost(roomId, postId);
    if (fromCache) {
      setPost(fromCache);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      if (fromCache) {
        const list = await roomsApi.listComments(roomId, postId);
        setComments(list);
        void roomsApi.getRoomPost(roomId, postId).then(setPost).catch(() => {});
        return;
      }
      const [detail, list] = await Promise.all([
        roomsApi.getRoomPost(roomId, postId),
        roomsApi.listComments(roomId, postId),
      ]);
      setPost(detail);
      setComments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.loadPost'));
    } finally {
      setLoading(false);
    }
  }, [roomId, postId, t]);

  useEffect(() => {
    markRoomPostSeen(roomId, postId);
    void refresh();
  }, [refresh, roomId, postId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (post && isUserBlocked(post.authorUserId) && post.authorUserId !== userId) {
      onBack();
    }
  }, [post, userId, onBack, blockTick]);

  const handleComment = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const prevIds = new Set(comments.map((c) => c.id));
    try {
      const commentNick = nickname.trim() || t('common.anonymous');
      const created = await roomsApi.createComment(roomId, postId, body, {
        pushTitle: commentNick,
        pushBody: t('rooms.commentPushBody'),
      });
      // 화면에 붙이기 전: 서버 최신 목록 확인 → 상대 새 댓글 반영 후 내 댓글 포함 표시
      let list: RoomComment[] | null = null;
      try {
        list = await roomsApi.listComments(roomId, postId);
      } catch {
        list = null;
      }
      if (list) {
        const freshFromOthers = list.filter(
          (c) => !prevIds.has(c.id) && c.authorUserId !== userId,
        );
        if (freshFromOthers.length > 0) {
          setToast(t('rooms.newCommentToast'));
        }
        setComments(list);
      } else {
        setComments((prev) => [...prev, created]);
      }
      setText('');
      commentFocusedRef.current = true;
      commentInputRef.current?.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        syncKeyboardScrollRef.current();
        window.setTimeout(() => syncKeyboardScrollRef.current(), 50);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.comment'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!post || post.authorUserId !== userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await roomsApi.deleteRoomPost(roomId, postId);
      setConfirmDelete(false);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.delete'));
      setBusy(false);
    }
  };

  const openSafety = (target: SafetyTarget) => {
    if (!target.userId || target.userId === userId) return;
    setSafetyTarget(target);
  };

  const authorName = post
    ? roomAuthorLabel(post.authorNickname, post.authorWithdrawn, t)
    : '';
  const postAvatarUrl = post?.authorWithdrawn ? '' : authorAvatarUrl;
  const authorInitial = (authorName || '?').slice(0, 1).toUpperCase();

  return (
    <div ref={pageRef} className="rooms rooms--post">
      <div className="rooms__toolbar">
        <button
          type="button"
          className="rooms__back"
          onClick={onBack}
          aria-label={t('rooms.backToRoomAria')}
        >
          <BackIcon />
        </button>
        <h2>{t('rooms.sharedDiary')}</h2>
        {post?.authorUserId === userId ? (
          <button
            type="button"
            className="rooms__danger"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            {t('common.delete')}
          </button>
        ) : post ? (
          <button
            type="button"
            className="rooms__more"
            disabled={busy}
            aria-label={t('rooms.safety.moreAria')}
            onClick={() =>
              openSafety({
                roomId,
                userId: post.authorUserId,
                nickname: post.authorNickname,
                kind: 'post',
                postId: post.id,
              })
            }
          >
            ···
          </button>
        ) : (
          <span className="rooms__toolbar-balance" aria-hidden />
        )}
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && <p className="rooms__muted">{t('common.loading')}</p>}

      {post && (
        <div className="rooms__post-expand">
          <div className="rooms__post-by">
            <span className="rooms__gallery-avatar" aria-hidden>
              {postAvatarUrl ? (
                <img src={postAvatarUrl} alt="" />
              ) : (
                <span className="rooms__gallery-initial">{authorInitial}</span>
              )}
            </span>
            <span className="rooms__post-by-name">{authorName}</span>
          </div>
          <RoomDiaryPaper post={post} className="rooms__paper--expand" />
        </div>
      )}

      <section className="rooms__comments">
        <h3>{t('rooms.comments', { n: visibleComments.length })}</h3>
        <ul ref={commentListRef} className="rooms__comment-list">
          {visibleComments.map((c, i) => {
            const prev = visibleComments[i - 1];
            const showName = !prev || prev.authorUserId !== c.authorUserId;
            const isMine = c.authorUserId === userId;
            const colorIdx = colorMap.get(c.authorUserId) ?? 0;
            return (
              <li
                key={c.id}
                className={[
                  'rooms__comment',
                  isMine ? 'rooms__comment--mine' : 'rooms__comment--other',
                  showName ? 'rooms__comment--named' : 'rooms__comment--cont',
                  `rooms__comment--c${colorIdx}`,
                ].join(' ')}
              >
                {showName && !isMine && (
                  <div className="rooms__comment-head">
                    <strong className="rooms__comment-name">
                      {roomAuthorLabel(c.authorNickname, c.authorWithdrawn, t)}
                    </strong>
                  </div>
                )}
                <span className="rooms__comment-bubble">{c.text}</span>
              </li>
            );
          })}
        </ul>
        <div ref={commentFormRef} className="rooms__comment-form">
          <input
            ref={commentInputRef}
            type="text"
            value={text}
            maxLength={200}
            placeholder={t('rooms.commentPlaceholder')}
            onChange={(e) => setText(e.target.value)}
            onFocus={onCommentFocus}
            onBlur={onCommentBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleComment();
              }
            }}
          />
          <button
            type="button"
            className="rooms__btn primary"
            disabled={busy || !text.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => void handleComment()}
          >
            {t('rooms.commentSubmit')}
          </button>
        </div>
        {/* 키보드가 가린 만큼 스크롤 여유 — 입력칸만 fixed로 띄우지 않음 */}
        <div ref={commentSpacerRef} className="rooms__comment-spacer" aria-hidden />
      </section>

      {confirmDelete && (
        <AppModal
          title={t('rooms.confirm.deletePost')}
          onDismiss={() => {
            if (!busy) setConfirmDelete(false);
          }}
          showClose={!busy}
          closeAriaLabel={t('common.close')}
          primaryDanger
          primaryLabel={busy ? t('rooms.deleting') : t('common.delete')}
          onPrimary={() => {
            if (!busy) void handleDelete();
          }}
        />
      )}

      {safetyTarget && (
        <RoomSafetyModal
          target={safetyTarget}
          onClose={() => setSafetyTarget(null)}
          onBlocked={() => {
            setBlockTick((n) => n + 1);
            if (post && safetyTarget.userId === post.authorUserId) onBack();
          }}
          onDone={setToast}
        />
      )}

      {toast ? (
        <div className="rooms__toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export default RoomPostPage;
