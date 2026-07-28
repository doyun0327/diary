import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry, Mood } from '../types/diary';
import { MOODS } from '../types/diary';
import type { CharacterProfile } from '../types/character';
import CalendarPopup from '../components/CalendarPopup';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import MoodIcon from '../components/MoodIcon';
import { HairStyleIcon } from '../components/CharacterIcons';
import { generateDiaryImage } from '../api/aiImage';
import type { AiProgress } from '../api/aiImage';
import { formatDate, today } from '../utils/date';
import { findFont, getPreferredFontId } from '../utils/fonts';
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
  const { t } = useTranslation();
  const isEdit = Boolean(initialEntry);
  const [date, setDate] = useState(initialEntry?.date ?? today());
  const [title, setTitle] = useState(initialEntry?.title ?? '');
  const [content, setContent] = useState(initialEntry?.content ?? '');
  const [mood, setMood] = useState<Mood>(initialEntry?.mood ?? 'happy');
  const [fontId, setFontId] = useState(
    () => initialEntry?.fontId ?? getPreferredFontId(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState<AiProgress | null>(null);
  const [, setAiError] = useState<string | null>(null);
  const [, setAiScene] = useState<string | null>(null);
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
      setAiError(t('write.err.aiNeedContent'));
      return;
    }

    if (canvasRef.current?.hasContent()) {
      const ok = confirm(t('write.confirm.replaceWithAi'));
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
      setAiError(err instanceof Error ? err.message : t('write.err.aiFailed'));
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
      fontId,
      imageUrl,
    });
  };

  const aiLabel =
    aiStep === 'scene'
      ? t('write.ai.sceneStep')
      : aiStep === 'image'
        ? t('write.ai.drawStep')
        : t('write.ai.button');

  return (
    <form className="diary-write" onSubmit={handleSubmit}>
      <nav className="diary-write__nav">
        <button type="button" className="diary-write__nav-btn" onClick={onCancel}>
          {t('write.cancel')}
        </button>
        <span className="diary-write__nav-title">{isEdit ? t('write.title.edit') : t('write.title.new')}</span>
        <button
          type="submit"
          className="diary-write__nav-btn diary-write__nav-btn--save"
          disabled={aiLoading}
        >
          {isEdit ? t('write.saveEdit') : t('write.save')}
        </button>
      </nav>

      <div
        className="diary-write__paper"
        style={{ ['--diary-font' as string]: findFont(fontId).family }}
      >
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
                title={t(`mood.${m.value}`)}
                onClick={() => setMood(m.value)}
              >
                <MoodIcon mood={m.value} />
              </button>
            ))}
          </div>
        </div>


        <section className="diary-write__section">

          <div className="diary-write__title-row">
            <input
              type="text"
              className="diary-write__title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('write.titlePlaceholder')}
              maxLength={40}
            />
          </div>

          <div className="diary-write__canvas-wrap">
            <DrawingCanvas
              ref={canvasRef}
              fontId={fontId}
              onFontIdChange={setFontId}
            />
            {aiLoading && (
              <div className="diary-write__ai-loading">
                <span className="diary-write__ai-spinner" />
                <span>
                  {aiStep === 'scene' ? t('write.ai.statusScene') : t('write.ai.statusDraw')}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="diary-write__section diary-write__section--grow">
          <div className="diary-write__section-head">
            <div className="diary-write__ai-block">
              <div className="diary-write__ai-actions">
                <button
                  type="button"
                  className="diary-write__tip-btn"
                  onClick={() => setTipOpen((open) => !open)}
                  aria-expanded={tipOpen}
                >
                  {t('write.ai.tip')}
                </button>
                <div className="diary-write__ai-draw">
                  <button
                    type="button"
                    className="diary-write__ai-char"
                    onClick={onOpenCharacter}
                    aria-label={t('write.ai.characterAria')}
                    title={t('write.ai.characterTitle')}
                  >
                  <HairStyleIcon style={character.hairStyle} />
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
            </div>
          </div>

          {tipOpen && (
            <div className="diary-write__tip">
              <p className="diary-write__ai-note">
                {t('write.ai.tipBody')}
              </p>
              <p>
                <strong>{t('write.ai.tipVisible')}</strong>{t('write.ai.tipAsk')}
              </p>
              <ul>
                <li>{t('write.ai.exGood1')}</li>
                <li>{t('write.ai.exGood2')}</li>
                <li>{t('write.ai.exBad')}</li>
              </ul>
            </div>
          )}

          <textarea
            className="diary-write__content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('write.contentPlaceholder')}
          />
          {/* {aiScene && (
            <p className="diary-write__ai-scene">{t('write.ai.sceneUnderstood', { scene: aiScene })}</p>
          )}
          {aiError && <p className="diary-write__ai-error">{aiError}</p>} */}
        </section>
      </div>
    </form>
  );
}

export default DiaryWritePage;
