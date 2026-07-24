import { useCallback, useEffect, useState } from 'react';
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
      setError(err instanceof Error ? err.message : '글을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [roomId, postId]);

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
      setError(err instanceof Error ? err.message : '댓글을 남기지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!post || post.authorClientId !== clientId) return;
    if (!confirm('이 공유 일기를 방에서 삭제할까요?')) return;
    setBusy(true);
    try {
      await roomsApi.deleteRoomPost(roomId, postId);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했어요');
      setBusy(false);
    }
  };

  return (
    <div className="rooms">
      <div className="rooms__toolbar">
        <button type="button" onClick={onBack}>
          ← 방으로
        </button>
        <h2>공유 일기</h2>
        {post?.authorClientId === clientId ? (
          <button type="button" className="rooms__danger" disabled={busy} onClick={() => void handleDelete()}>
            삭제
          </button>
        ) : (
          <span />
        )}
      </div>

      {error && <p className="rooms__error">{error}</p>}
      {loading && <p className="rooms__muted">불러오는 중…</p>}

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
        <h3>댓글 {comments.length}</h3>
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
            placeholder="댓글을 남겨 보세요"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleComment();
            }}
          />
          <button type="button" className="rooms__btn primary" disabled={busy || !text.trim()} onClick={() => void handleComment()}>
            등록
          </button>
        </div>
      </section>
    </div>
  );
}

export default RoomPostPage;
