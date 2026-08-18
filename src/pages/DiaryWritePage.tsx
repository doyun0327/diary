import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLottie } from 'lottie-react';
import type { DiaryEntry, Mood } from '../types/diary';
import { MOODS } from '../types/diary';
import type { CharacterProfile } from '../types/character';
import CalendarPopup from '../components/CalendarPopup';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import MoodIcon from '../components/MoodIcon';
import { HAIR_STYLE_OPTIONS } from '../types/character';
import { generateDiaryImage } from '../api/aiImage';
import AppModal from '../components/AppModal';
import { formatDate, today } from '../utils/date';
import { diaryFontStack, findFont, getPreferredFontId } from '../utils/fonts';
import {
  isAiCoachSeen,
  isCharacterCoachSeen,
  isCharacterSetupDone,
  markAiCoachSeen,
  markCharacterCoachSeen,
} from '../utils/onboarding';
import { clearWriteDraft } from '../utils/writeDraft';
import { isFlutterApp } from '../utils/nativeShare';
import './DiaryWritePage.css';

function AiLoadingLottie({ animationData }: { animationData: object }) {
  const { View } = useLottie({
    animationData,
    loop: true,
    autoplay: true,
  });
  return <div className="diary-write__ai-lottie">{View}</div>;
}

const AI_LOTTIE_URLS = ['/lottie/ai-loading.json', '/lottie/ai-loading-cat.json'] as const;

function pickRandomLottie(pool: object[]): object | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
interface DiaryWritePageProps {
  character: CharacterProfile;
  /** 있으면 수정 모드 */
  initialEntry?: DiaryEntry;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onOpenCharacter: () => void;
  /** Flutter AppBar 저장 버튼 활성 상태 */
  onNativeSaveStateChange?: (enabled: boolean) => void;
}

function DiaryWritePage({
  character,
  initialEntry,
  onSave,
  onCancel,
  onOpenCharacter,
  onNativeSaveStateChange,
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
  const [aiError, setAiError] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [aiLottiePool, setAiLottiePool] = useState<object[]>([]);
  const [activeAiLottie, setActiveAiLottie] = useState<object | null>(null);
  const [aiLottieKey, setAiLottieKey] = useState(0);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [coach, setCoach] = useState<'character' | 'ai' | null>(() => {
    if (isEdit) return null;
    if (!isCharacterCoachSeen() && !isCharacterSetupDone()) return 'character';
    if (!isAiCoachSeen()) return 'ai';
    return null;
  });
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imageLoadedRef = useRef(false);

  useEffect(() => {
    onNativeSaveStateChange?.(!aiLoading);
  }, [aiLoading, onNativeSaveStateChange]);

  useEffect(() => {
    const onNativeSave = () => formRef.current?.requestSubmit();
    window.addEventListener('diary-write-save', onNativeSave);
    return () => window.removeEventListener('diary-write-save', onNativeSave);
  }, []);

  useEffect(() => {
    if (isEdit) {
      setCoach(null);
      return;
    }
    if (!isCharacterCoachSeen() && !isCharacterSetupDone()) {
      setCoach('character');
      return;
    }
    if (!isAiCoachSeen()) {
      setCoach('ai');
      return;
    }
    setCoach(null);
  }, [isEdit, character]);

  const dismissCharacterCoach = () => {
    markCharacterCoachSeen();
    setCoach((prev) => (prev === 'character' ? (isAiCoachSeen() ? null : 'ai') : prev));
  };

  const dismissAiCoach = () => {
    markAiCoachSeen();
    setCoach((prev) => (prev === 'ai' ? null : prev));
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      AI_LOTTIE_URLS.map((url) => fetch(url).then((res) => res.json() as Promise<object>)),
    )
      .then((pool) => {
        if (cancelled) return;
        setAiLottiePool(pool);
        setActiveAiLottie(pickRandomLottie(pool));
      })
      .catch(() => {
        if (!cancelled) {
          setAiLottiePool([]);
          setActiveAiLottie(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const src = initialEntry?.imageUrl;
    if (!src || imageLoadedRef.current) return;
    imageLoadedRef.current = true;
    void canvasRef.current?.loadImage(src);
  }, [initialEntry?.imageUrl]);

  const handleCancel = () => {
    if (!isEdit) clearWriteDraft();
    onCancel();
  };

  const handleCancelRef = useRef(handleCancel);
  handleCancelRef.current = handleCancel;

  useEffect(() => {
    const onNativeCancel = () => handleCancelRef.current();
    window.addEventListener('diary-write-cancel', onNativeCancel);
    return () => window.removeEventListener('diary-write-cancel', onNativeCancel);
  }, []);

  const handleAiDraw = () => {
    if (!content.trim()) {
      setAiError(t('write.err.aiNeedContent'));
      return;
    }
    if (canvasRef.current?.hasContent()) {
      setReplaceConfirmOpen(true);
      return;
    }
    void runAiDraw();
  };

  const runAiDraw = async () => {
    setReplaceConfirmOpen(false);
    setAiError(null);
    setActiveAiLottie(pickRandomLottie(aiLottiePool));
    setAiLottieKey((key) => key + 1);
    setAiLoading(true);
    try {
      const { imageUrl } = await generateDiaryImage({
        title,
        content,
        character,
      });
      await canvasRef.current?.loadImage(imageUrl);
      dismissAiCoach();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('write.err.aiFailed'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    let imageUrl: string | undefined;
    try {
      imageUrl = canvasRef.current?.toDataURL();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('write.err.saveImage'));
      return;
    }
    if (!title.trim() && !content.trim() && !imageUrl) {
      setAiError(t('write.err.empty'));
      return;
    }
    setAiError(null);
    clearWriteDraft();
    onSave({
      date,
      title: title.trim(),
      content: content.trim(),
      mood,
      fontId,
      imageUrl,
    });
  };

  const aiLabel = aiLoading ? t('write.ai.drawStep') : t('write.ai.button');

  return (
    <form ref={formRef} className="diary-write" onSubmit={handleSubmit}>
      {!isFlutterApp() && (
        <nav className="diary-write__nav">
          <button type="button" className="diary-write__nav-btn" onClick={handleCancel}>
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
      )}

      <div
        className="diary-write__paper"
        style={{ ['--diary-font' as string]: diaryFontStack(findFont(fontId).family) }}
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
              <div className="diary-write__ai-loading" aria-busy="true" aria-label={t('write.ai.drawStep')}>
                {activeAiLottie && (
                  <AiLoadingLottie key={aiLottieKey} animationData={activeAiLottie} />
                )}
                <p className="diary-write__ai-loading-text">{t('write.ai.statusDraw')}</p>
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
                  <div className="diary-write__coach-anchor">
                    <button
                      type="button"
                      className="diary-write__ai-char"
                      onClick={() => {
                        dismissCharacterCoach();
                        onOpenCharacter();
                      }}
                      aria-label={t('write.ai.characterAria')}
                      title={t('write.ai.characterTitle')}
                    >
                      <span className="diary-write__ai-char-emoji" aria-hidden>
                        {HAIR_STYLE_OPTIONS.find((o) => o.value === character.hairStyle)?.emoji ?? '👤'}
                      </span>
                    </button>
                    {coach === 'character' && (
                      <div className="diary-write__coach" role="status">
                        <p>{t('write.coach.character')}</p>
                        <button
                          type="button"
                          className="diary-write__coach-dismiss"
                          aria-label={t('common.close')}
                          onClick={dismissCharacterCoach}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="diary-write__coach-anchor diary-write__coach-anchor--ai">
                    <button
                      type="button"
                      className="diary-write__ai-link"
                      onClick={handleAiDraw}
                      disabled={aiLoading || !content.trim()}
                    >
                      {aiLabel}
                    </button>
                    {coach === 'ai' && (
                      <div className="diary-write__coach diary-write__coach--ai" role="status">
                        <p>{t('write.coach.ai')}</p>
                        <button
                          type="button"
                          className="diary-write__coach-dismiss"
                          aria-label={t('common.close')}
                          onClick={dismissAiCoach}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
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
          {aiError && <p className="diary-write__ai-error">{aiError}</p>}
        </section>
      </div>
      {replaceConfirmOpen && (
        <AppModal
          title={t('write.confirm.replaceTitle')}
          lead={t('write.confirm.replaceWithAi')}
          onDismiss={() => setReplaceConfirmOpen(false)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('common.cancel')}
          onSecondary={() => setReplaceConfirmOpen(false)}
          primaryLabel={t('write.confirm.replaceOk')}
          onPrimary={() => void runAiDraw()}
        />
      )}
    </form>
  );
}

export default DiaryWritePage;
