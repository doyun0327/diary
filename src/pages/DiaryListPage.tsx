import type { DiaryEntry } from '../types/diary';
import DiaryCard from '../components/DiaryCard';
import './DiaryListPage.css';

interface DiaryListPageProps {
  entries: DiaryEntry[];
  onSelect: (id: string) => void;
}

function DiaryListPage({ entries, onSelect }: DiaryListPageProps) {
  if (entries.length === 0) {
    return (
      <div className="diary-list diary-list--empty">
        <p>아직 작성한 일기가 없어요.</p>
        <p>첫 번째 diary를 남겨 보세요!</p>
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
