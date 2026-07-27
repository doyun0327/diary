import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import DiaryCard from '../components/DiaryCard';
import './DiaryListPage.css';

interface DiaryListPageProps {
  entries: DiaryEntry[];
  onSelect: (id: string) => void;
}

function DiaryListPage({ entries, onSelect }: DiaryListPageProps) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return (
      <div className="diary-list diary-list--empty">
        <p>{t('diary.empty.line1')}</p>
        <p>{t('diary.empty.line2')}</p>
      </div>
    );
  }

  return (
    <div className="diary-list">
      {entries.map((entry) => (
        <DiaryCard key={entry.id} entry={entry} onClick={() => onSelect(entry.id)} />
      ))}
    </div>
  );
}

export default DiaryListPage;
