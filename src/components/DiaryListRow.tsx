import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import { formatDate } from '../utils/date';
import MoodIcon from './MoodIcon';
import './DiaryListRow.css';

interface DiaryListRowProps {
  entry: DiaryEntry;
  onClick: () => void;
}

function DiaryListRow({ entry, onClick }: DiaryListRowProps) {
  const { t } = useTranslation();
  const preview = entry.content?.trim() || entry.title?.trim() || t('diary.list.noPreview');

  return (
    <button type="button" className="diary-row" onClick={onClick}>
      <span className="diary-row__mood" aria-hidden>
        <MoodIcon mood={entry.mood} packId={entry.moodPack} />
      </span>
      <span className="diary-row__body">
        <strong className="diary-row__date">{formatDate(entry.date)}</strong>
        <span className="diary-row__preview">{preview}</span>
      </span>
      {entry.imageUrl ? (
        <img
          className="diary-row__thumb"
          src={entry.imageUrl}
          alt={t('diary.card.imageAlt', { date: entry.date })}
        />
      ) : (
        <span className="diary-row__thumb diary-row__thumb--empty" aria-hidden>
          🖼️
        </span>
      )}
    </button>
  );
}

export default DiaryListRow;
