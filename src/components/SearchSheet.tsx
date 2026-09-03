import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import CloseIcon from './CloseIcon';
import DiaryListRow from './DiaryListRow';
import './SearchSheet.css';

interface SearchSheetProps {
  entries: DiaryEntry[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

function normalize(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function SearchSheet({ entries, onClose, onSelect }: SearchSheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const needle = normalize(query);
  const results = useMemo(() => {
    if (!needle) return [];
    return entries
      .filter((entry) => {
        const hay = normalize(`${entry.title} ${entry.content}`);
        return hay.includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  }, [entries, needle]);

  return (
    <div className="search-sheet" role="dialog" aria-label={t('diary.search.aria')}>
      <div className="search-sheet__backdrop" onClick={onClose} />
      <div className="search-sheet__panel">
        <header className="search-sheet__head">
          <h2>{t('diary.search.title')}</h2>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        <label className="search-sheet__field">
          <span className="search-sheet__field-icon" aria-hidden>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('diary.search.placeholder')}
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        {!needle ? (
          <p className="search-sheet__hint">{t('diary.search.empty')}</p>
        ) : results.length === 0 ? (
          <p className="search-sheet__hint">{t('diary.search.noResults')}</p>
        ) : (
          <div className="search-sheet__results">
            <p className="search-sheet__count">{t('diary.search.count', { n: results.length })}</p>
            {results.map((entry) => (
              <DiaryListRow
                key={entry.id}
                entry={entry}
                highlightQuery={query}
                onClick={() => onSelect(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchSheet;
