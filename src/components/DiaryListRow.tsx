import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import { formatDate } from '../utils/date';
import { useCroppedDiaryImage } from '../hooks/useCroppedDiaryImage';
import MoodIcon from './MoodIcon';
import './DiaryListRow.css';

interface DiaryListRowProps {
  entry: DiaryEntry;
  onClick: () => void;
  highlightQuery?: string;
}

function DiaryRowThumb({ src, alt }: { src: string; alt: string }) {
  const displaySrc = useCroppedDiaryImage(src);
  return <img className="diary-row__thumb" src={displaySrc} alt={alt} decoding="async" />;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstMatchIndex(text: string, query: string) {
  return text.toLowerCase().indexOf(query.toLowerCase());
}

function snippetAroundMatch(text: string, query: string, radius = 22) {
  const index = firstMatchIndex(text, query);
  if (index < 0) return text;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function highlightMatches(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'));
  const lower = needle.toLowerCase();
  return parts.map((part, index) =>
    part.toLowerCase() === lower ? (
      <mark key={index} className="diary-row__hit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function searchPreview(entry: DiaryEntry, query: string, fallback: string) {
  const needle = query.trim();
  const content = entry.content?.trim() ?? '';
  const title = entry.title?.trim() ?? '';
  if (needle && firstMatchIndex(content, needle) >= 0) {
    return snippetAroundMatch(content, needle);
  }
  if (needle && firstMatchIndex(title, needle) >= 0) {
    return title;
  }
  return content || title || fallback;
}

function DiaryListRow({ entry, onClick, highlightQuery }: DiaryListRowProps) {
  const { t } = useTranslation();
  const preview = searchPreview(
    entry,
    highlightQuery ?? '',
    t('diary.list.noPreview'),
  );

  return (
    <button type="button" className="diary-row" onClick={onClick}>
      <span className="diary-row__mood" aria-hidden>
        <MoodIcon mood={entry.mood} packId={entry.moodPack} />
      </span>
      <span className="diary-row__body">
        <strong className="diary-row__date">{formatDate(entry.date)}</strong>
        <span className="diary-row__preview">
          {highlightQuery?.trim() ? highlightMatches(preview, highlightQuery) : preview}
        </span>
      </span>
      {entry.imageUrl ? (
        <DiaryRowThumb
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
