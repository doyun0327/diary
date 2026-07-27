import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import { MOOD_MAP } from '../types/diary';
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
          {MOOD_MAP[entry.mood].emoji} {entry.title || entry.date}
        </h3>
        <p className="diary-card__meta">
          {entry.content || entry.date}
        </p>
      </div>
    </article>
  );
}

export default DiaryCard;
