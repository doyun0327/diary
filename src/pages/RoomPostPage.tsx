import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [commentFocused, setCommentFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const commentFormRef = useRef<HTMLDivElement>(null);
  const commentFocusedRef = useRef(false);

  useEffect(() => subscribeBlockedUsers(() => setBlockTick((n) => n + 1)), []);

  useEffect(() => {
    commentFocusedRef.current = commentFocused;
  }, [commentFocused]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const vv = window.visualViewport;

    const measureInset = () => {
      let inset = 0;
      if (vv) {
        inset = Math.max(
          0,
          Math.round(window.innerHeight - vv.height - vv.offsetTop),
        );
      }
      // Flutter WebView 등은 visualViewport가 안 줄어듦 → 포커스 시 최소 들어 올림
      if (commentFocusedRef.current) {
        const fallback = Math.round(
          Math.min(420, Math.max(260, window.innerHeight * 0.42)),
        );
        inset = Math.max(inset, fallback);
      }
      return inset;
    };

    const liftCommentForm = () => {
      const form = commentFormRef.current;
      if (!form || !commentFocusedRef.current) return;
      // 입력칸이 보이는 영역 하단에 오도록 스크롤
      const rootRect = root.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const visibleBottom = vv
        ? Math.min(rootRect.bottom, vv.offsetTop + vv.height)
        : rootRect.bottom;
      const safeBottom = visibleBottom - 12;
      if (formRect.bottom > safeBottom) {
        root.scrollTop += formRect.bottom - safeBottom;
      }
    };

    const syncKeyboardInset = () => {
      const inset = measureInset();
      root.style.setProperty('--rooms-keyboard-inset', `${inset}px`);
      root.classList.toggle('rooms--keyboard-open', inset > 0);
      if (commentFocusedRef.current) {
        requestAnimationFrame(liftCommentForm);
      }
    };

    vv?.addEventListener('resize', syncKeyboardInset);
    vv?.addEventListener('scroll', syncKeyboardInset);
    window.addEventListener('resize', syncKeyboardInset);
    syncKeyboardInset();

    return () => {
      vv?.removeEventListener('resize', syncKeyboardInset);
      vv?.removeEventListener('scroll', syncKeyboardInset);
      window.removeEventListener('resize', syncKeyboardInset);
      root.style.removeProperty('--rooms-keyboard-inset');
      root.classList.remove('rooms--keyboard-open');
    };
  }, [commentFocused]);

  const onCommentFocus = () => {
    setCommentFocused(true);
    commentFocusedRef.current = true;
    const root = rootRef.current;
    if (root) {
      const fallback = Math.round(
        Math.min(420, Math.max(260, window.innerHeight * 0.42)),
      );
      root.style.setProperty('--rooms-keyboard-inset', `${fallback}px`);
      root.classList.add('rooms--keyboard-open');
    }
    // 키보드 애니메이션 동안 여러 번 올림
    const bump = () => {
      const form = commentFormRef.current;
      const el = rootRef.current;
      if (!form || !el) return;
      form.scrollIntoView({ block: 'end', behavior: 'auto' });
      const formRect = form.getBoundingClientRect();
      const room = Math.min(window.innerHeight, el.getBoundingClientRect().bottom);
      const need = formRect.bottom - (room - 16);
      if (need > 0) el.scrollTop += need;
    };
    requestAnimationFrame(bump);
    window.setTimeout(bump, 100);
    window.setTimeout(bump, 280);
    window.setTimeout(bump, 480);
  };

  const onCommentBlur = () => {
    setCommentFocused(false);
    commentFocusedRef.current = false;
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty('--rooms-keyboard-inset', '0px');
    root.classList.remove('rooms--keyboard-open');
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
    try {
      const commentNick = nickname.trim() || t('common.anonymous');
      const created = await roomsApi.createComment(roomId, postId, body, {
        pushTitle: commentNick,
        pushBody: t('rooms.commentPushBody'),
      });
      setComments((prev) => [...prev, created]);
      setText('');
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
    <div ref={rootRef} className="rooms rooms--post">
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
        <ul className="rooms__comment-list">
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
            type="text"
            value={text}
            maxLength={200}
            placeholder={t('rooms.commentPlaceholder')}
            onChange={(e) => setText(e.target.value)}
            onFocus={onCommentFocus}
            onBlur={onCommentBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleComment();
            }}
          />
          <button
            type="button"
            className="rooms__btn primary"
            disabled={busy || !text.trim()}
            onClick={() => void handleComment()}
          >
            {t('rooms.commentSubmit')}
          </button>
        </div>
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
