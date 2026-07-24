import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { DiaryEntry, Mood } from '../types/diary';
import { MOODS } from '../types/diary';
import type { CharacterProfile } from '../types/character';
import { summarizeCharacterKo } from '../types/character';
import CalendarPopup from '../components/CalendarPopup';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import { generateDiaryImage } from '../api/aiImage';
import type { AiProgress } from '../api/aiImage';
import { formatDate, today } from '../utils/date';
import './DiaryWritePage.css';

interface DiaryWritePageProps {
  character: CharacterProfile;
  /** 있으면 수정 모드 */
  initialEntry?: DiaryEntry;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onOpenCharacter: () => void;
}

function DiaryWritePage({
  character,
  initialEntry,
  onSave,
  onCancel,
  onOpenCharacter,
}: DiaryWritePageProps) {
  const isEdit = Boolean(initialEntry);
  const [date, setDate] = useState(initialEntry?.date ?? today());
  const [title, setTitle] = useState(initialEntry?.title ?? '');
  const [content, setContent] = useState(initialEntry?.content ?? '');
  const [mood, setMood] = useState<Mood>(initialEntry?.mood ?? 'happy');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState<AiProgress | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiScene, setAiScene] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const imageLoadedRef = useRef(false);

  useEffect(() => {
    if (!initialEntry?.imageUrl || imageLoadedRef.current) return;
    imageLoadedRef.current = true;
    void canvasRef.current?.loadImage(initialEntry.imageUrl);
  }, [initialEntry?.imageUrl]);

  const handleAiDraw = async () => {
    if (!content.trim()) {
      setAiError('일기 내용을 먼저 적어 주세요');
      return;
    }

    if (canvasRef.current?.hasContent()) {
      const ok = confirm('그림판 내용을 AI 그림으로 바꿀까요?');
      if (!ok) return;
    }

    setAiError(null);
    setAiScene(null);
    setAiLoading(true);
    setAiStep('scene');
    try {
      const { imageUrl, scene } = await generateDiaryImage({
        title,
        content,
        character,
        onProgress: setAiStep,
      });
      await canvasRef.current?.loadImage(imageUrl);
      if (scene) setAiScene(scene);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '그림 생성에 실패했습니다');
    } finally {
      setAiLoading(false);
      setAiStep(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const imageUrl = canvasRef.current?.toDataURL();
    if (!title.trim() && !content.trim() && !imageUrl) return;
    onSave({
      date,
      title: title.trim(),
      content: content.trim(),
      mood,
      imageUrl,
    });
  };

  const aiLabel =
    aiStep === 'scene'
      ? '장면 만드는 중…'
      : aiStep === 'image'
        ? '그리는 중…'
        : '✨ AI 그림';

  return (
    <form className="diary-write" onSubmit={handleSubmit}>
      <nav className="diary-write__nav">
        <button type="button" className="diary-write__nav-btn" onClick={onCancel}>
          취소
        </button>
        <span className="diary-write__nav-title">{isEdit ? '일기 수정' : '오늘의 일기'}</span>
        <button
          type="submit"
          className="diary-write__nav-btn diary-write__nav-btn--save"
          disabled={aiLoading}
        >
          {isEdit ? '수정 완료' : '저장'}
        </button>
      </nav>

      <div className="diary-write__paper">
        <div className="diary-write__meta">
          <button
            type="button"
            className="diary-write__date"
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

          <div className="diary-write__moods">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={mood === m.value ? 'selected' : ''}
                title={m.label}
                onClick={() => setMood(m.value)}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="diary-write__character" onClick={onOpenCharacter}>
          <span className="diary-write__character-label">내 캐릭터</span>
          <span className="diary-write__character-value">{summarizeCharacterKo(character)}</span>
        </button>

        <section className="diary-write__section">
          <h2>그림</h2>

          <div className="diary-write__title-row">
            <input
              type="text"
              className="diary-write__title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 적어 주세요"
              maxLength={40}
            />
          </div>

          <div className="diary-write__canvas-wrap">
            <DrawingCanvas ref={canvasRef} />
            {aiLoading && (
              <div className="diary-write__ai-loading">
                <span className="diary-write__ai-spinner" />
                <span>
                  {aiStep === 'scene' ? '장면을 생각하고 있어요…' : '그림을 그리고 있어요…'}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="diary-write__section diary-write__section--grow">
          <div className="diary-write__section-head">
            <h2>일기</h2>
            <div className="diary-write__ai-actions">
              <button
                type="button"
                className="diary-write__tip-btn"
                onClick={() => setTipOpen((open) => !open)}
                aria-expanded={tipOpen}
              >
                팁
              </button>
              <button
                type="button"
                className="diary-write__ai-link"
                onClick={handleAiDraw}
                disabled={aiLoading || !content.trim()}
              >
                {aiLabel}
              </button>
            </div>
          </div>

          {tipOpen && (
            <div className="diary-write__tip">
              <p className="diary-write__ai-note">
                AI는 일기 앞부분의 장면을 중심으로 그려요. 캐릭터는 모습만 맞춰요.
              </p>
              <p>
                <strong>눈에 보이는 행동·장소</strong>를 적어 주세요.
              </p>
              <ul>
                <li>좋은 예: 오늘은 피자 파티를 했어요</li>
                <li>좋은 예: 공원에서 강아지랑 뛰어놀았어요</li>
                <li>아쉬운 예: 오늘 기분이 좋았어요</li>
              </ul>
            </div>
          )}

          <textarea
            className="diary-write__content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="예) 오늘은 피자 파티를 했어요. 친구들이랑 웃으면서 먹었어요"
          />
          {aiScene && (
            <p className="diary-write__ai-scene">AI가 이해한 장면: {aiScene}</p>
          )}
          {aiError && <p className="diary-write__ai-error">{aiError}</p>}
        </section>
      </div>
    </form>
  );
}

export default DiaryWritePage;
