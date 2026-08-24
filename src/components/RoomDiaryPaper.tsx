import { useTranslation } from 'react-i18next';
import type { RoomPost } from '../types/room';
import { formatDate } from '../utils/date';
import MoodIcon from './MoodIcon';
import '../pages/DiaryDetailPage.css';

interface RoomDiaryPaperProps {
  post: Pick<RoomPost, 'date' | 'title' | 'content' | 'mood' | 'moodPack' | 'imageUrl'>;
  /** 갤러리용 축소 paper */
  compact?: boolean;
  className?: string;
}

/** PDF/상세 diary-detail__paper 와 동일한 구성 */
function RoomDiaryPaper({ post, compact = false, className = '' }: RoomDiaryPaperProps) {
  const { t } = useTranslation();
  const label = post.title || formatDate(post.date);

  return (
    <article
      className={`diary-detail__paper rooms__paper${compact ? ' rooms__paper--compact' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="diary-detail__dateline">
        <span>{formatDate(post.date)}</span>
        <span className="diary-detail__mood">
          <MoodIcon mood={post.mood} packId={post.moodPack} size={compact ? 16 : 22} />
        </span>
      </div>

      {post.title ? <h2 className="diary-detail__title">{post.title}</h2> : null}

      {post.imageUrl ? (
        <div className="diary-detail__image">
          <img
            src={post.imageUrl}
            alt={t('detail.imageAltTitle', { title: label })}
            draggable={false}
            loading={compact ? 'lazy' : 'eager'}
            decoding="async"
          />
        </div>
      ) : null}

      {!compact ? (
        <section className="diary-detail__section">
          <p className="diary-detail__content">{post.content || ' '}</p>
        </section>
      ) : null}
    </article>
  );
}

export default RoomDiaryPaper;
