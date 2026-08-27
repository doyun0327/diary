import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomComment, RoomPost } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import AppModal from '../components/AppModal';
import BackIcon from '../components/BackIcon';
import RoomDiaryPaper from '../components/RoomDiaryPaper';
import { getCachedRoomPost } from '../utils/roomCache';
import { roomAuthorLabel } from '../utils/roomDisplay';
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

  const colorMap = useMemo(() => buildCommentColorMap(comments), [comments]);

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
    void refresh();
  }, [refresh]);

  const handleComment = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await roomsApi.createComment(roomId, postId, body);
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

  return (
    <div className="rooms rooms--post">
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
        ) : (
          <span className="rooms__toolbar-balance" aria-hidden />
        )}
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && <p className="rooms__muted">{t('common.loading')}</p>}

      {post && (
        <div className="rooms__post-expand">
          <p className="rooms__post-by">
            {roomAuthorLabel(post.authorNickname, post.authorWithdrawn, t)}
          </p>
          <RoomDiaryPaper post={post} className="rooms__paper--expand" />
        </div>
      )}

      <section className="rooms__comments">
        <h3>{t('rooms.comments', { n: comments.length })}</h3>
        <ul className="rooms__comment-list">
          {comments.map((c, i) => {
            const prev = comments[i - 1];
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
                  <strong className="rooms__comment-name">
                    {roomAuthorLabel(c.authorNickname, c.authorWithdrawn, t)}
                  </strong>
                )}
                <span className="rooms__comment-bubble">{c.text}</span>
              </li>
            );
          })}
        </ul>
        <div className="rooms__comment-form">
          <input
            type="text"
            value={text}
            maxLength={200}
            placeholder={t('rooms.commentPlaceholder')}
            onChange={(e) => setText(e.target.value)}
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
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('common.cancel')}
          onSecondary={() => {
            if (!busy) setConfirmDelete(false);
          }}
          primaryDanger
          primaryLabel={busy ? t('rooms.deleting') : t('common.delete')}
          onPrimary={() => {
            if (!busy) void handleDelete();
          }}
        />
      )}
    </div>
  );
}

export default RoomPostPage;
