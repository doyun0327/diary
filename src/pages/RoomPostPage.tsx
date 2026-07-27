import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomComment, RoomPost } from '../types/room';
import { MOOD_MAP } from '../types/diary';
import { formatDate } from '../utils/date';
import * as roomsApi from '../api/roomsApi';
import './RoomsPages.css';

interface RoomPostPageProps {
  roomId: string;
  postId: string;
  clientId: string;
  onBack: () => void;
}

function RoomPostPage({ roomId, postId, clientId, onBack }: RoomPostPageProps) {
  const { t } = useTranslation();
  const [post, setPost] = useState<RoomPost | null>(null);
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
    if (!post || post.authorClientId !== clientId) return;
    if (!confirm(t('rooms.confirm.deletePost'))) return;
    setBusy(true);
    try {
      await roomsApi.deleteRoomPost(roomId, postId);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rooms.err.delete'));
      setBusy(false);
    }
  };

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button type="button" onClick={onBack}>
          {t('rooms.backToRoom')}
        </button>
        <h2>{t('rooms.sharedDiary')}</h2>
        {post?.authorClientId === clientId ? (
          <button type="button" className="rooms__danger" disabled={busy} onClick={() => void handleDelete()}>
            {t('common.delete')}
          </button>
        ) : (
          <span />
        )}
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && <p className="rooms__muted">{t('common.loading')}</p>}

      {post && (
        <article className="rooms__post">
          <p className="rooms__post-meta">
            {post.authorNickname} · {formatDate(post.date)} · {MOOD_MAP[post.mood]?.emoji}
          </p>
          {post.title && <h3 className="rooms__post-title">{post.title}</h3>}
          {post.imageUrl && (
            <div className="rooms__post-image">
              <img src={post.imageUrl} alt="" />
            </div>
          )}
          <p className="rooms__post-content">{post.content}</p>
        </article>
      )}

      <section className="rooms__comments">
        <h3>{t('rooms.comments', { n: comments.length })}</h3>
        <ul className="rooms__comment-list">
          {comments.map((c) => (
            <li key={c.id}>
              <strong>{c.authorNickname}</strong>
              <span>{c.text}</span>
            </li>
          ))}
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
          <button type="button" className="rooms__btn primary" disabled={busy || !text.trim()} onClick={() => void handleComment()}>
            {t('rooms.commentSubmit')}
          </button>
        </div>
      </section>
    </div>
  );
}

export default RoomPostPage;
