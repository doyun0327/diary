import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import MoodIcon from './MoodIcon';
import './DiaryCard.css';

interface DiaryCardProps {
  entry: DiaryEntry;
  onClick: () => void;
}

function DiaryCard({ entry, onClick }: DiaryCardProps) {
  const { t } = useTranslation();

  return (
    <article className="diary-card" onClick={onClick}>
      <div className="diary-card__image">
        {entry.imageUrl ? (
          <img src={entry.imageUrl} alt={t('diary.card.imageAlt', { date: entry.date })} />
        ) : (
          <span className="diary-card__placeholder">🖼️</span>
        )}
      </div>
      <div className="diary-card__body">
        <h3>
          <MoodIcon mood={entry.mood} packId={entry.moodPack} size={18} /> {entry.title || entry.date}
        </h3>
        <p className="diary-card__meta">
          {entry.content || entry.date}
        </p>
      </div>
    </article>
  );
}

export default DiaryCard;
