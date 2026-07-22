import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { DiaryEntry, Mood } from '../types/diary';
import { MOODS, MOOD_MAP } from '../types/diary';
import CalendarPopup from '../components/CalendarPopup';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import { formatDate, today } from '../utils/date';
import './DiaryWritePage.css';

interface DiaryWritePageProps {
  onSave: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

function DiaryWritePage({ onSave, onCancel }: DiaryWritePageProps) {
  const [date, setDate] = useState(today());
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<Mood>('happy');
  const [moodOpen, setMoodOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  const selectMood = (value: Mood) => {
    setMood(value);
    setMoodOpen(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const imageUrl = canvasRef.current?.toDataURL();
    if (!content.trim() && !imageUrl) return;
    onSave({ date, content: content.trim(), mood, imageUrl });
  };

  return (
    <form className="diary-write" onSubmit={handleSubmit}>
      <div className="diary-write__toolbar">
        <button type="button" onClick={onCancel}>
          ← 돌아가기
        </button>
      </div>

      <div className="diary-write__dateline">
        <div className="diary-write__date">
          <button
            type="button"
            className="diary-write__date-btn"
            onClick={() => setCalendarOpen((open) => !open)}
          >
            {formatDate(date)}
          </button>
          {calendarOpen && (
            <CalendarPopup
              value={date}
              onSelect={(d) => {
                setDate(d);
                setCalendarOpen(false);
              }}
              onClose={() => setCalendarOpen(false)}
            />
          )}
        </div>
        <button
          type="button"
          className="diary-write__mood-selected"
          onClick={() => setMoodOpen((open) => !open)}
        >
          기분 <span className="diary-write__mood-emoji">{MOOD_MAP[mood].emoji}</span>
        </button>
      </div>

      {moodOpen && (
        <div className="diary-write__mood-grid">
          {MOODS.map((m) => (
            <label
              key={m.value}
              className={mood === m.value ? 'selected' : ''}
              title={m.label}
            >
              <input
                type="radio"
                name="mood"
                value={m.value}
                checked={mood === m.value}
                onChange={() => selectMood(m.value)}
              />
              <span className="diary-write__mood-emoji">{m.emoji}</span>
              <span className="diary-write__mood-label">{m.label}</span>
            </label>
          ))}
        </div>
      )}

      <DrawingCanvas ref={canvasRef} />

      <textarea
        className="diary-write__content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="오늘 있었던 일을 적어 보세요"
      />

      <button type="submit" className="diary-write__submit">
        저장하기
      </button>
    </form>
  );
}

export default DiaryWritePage;
