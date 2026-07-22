import type { DiaryEntry } from '../types/diary';
import { MOOD_MAP } from '../types/diary';
import { formatDate } from '../utils/date';
import './DiaryDetailPage.css';

interface DiaryDetailPageProps {
  entry: DiaryEntry;
  onBack: () => void;
  onDelete: (id: string) => void;
}

function DiaryDetailPage({ entry, onBack, onDelete }: DiaryDetailPageProps) {
  const handleDelete = () => {
    if (confirm('이 일기를 삭제할까요?')) {
      onDelete(entry.id);
      onBack();
    }
  };

  return (
    <article className="diary-detail">
      <div className="diary-detail__toolbar">
        <button type="button" onClick={onBack}>
          ← 목록으로
        </button>
        <button type="button" className="danger" onClick={handleDelete}>
          삭제
        </button>
      </div>

      <div className="diary-detail__dateline">
        <span>{formatDate(entry.date)}</span>
        <span className="diary-detail__mood">
          기분 {MOOD_MAP[entry.mood].emoji}
        </span>
      </div>

      {entry.imageUrl && (
        <div className="diary-detail__image">
          <img src={entry.imageUrl} alt={`${entry.date} 그림`} />
        </div>
      )}

      <p className="diary-detail__content">{entry.content}</p>
    </article>
  );
}

export default DiaryDetailPage;
