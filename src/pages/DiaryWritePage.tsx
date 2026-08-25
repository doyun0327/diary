import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLottie } from 'lottie-react';
import type { DiaryEntry, DiarySticker } from '../types/diary';
import { isMood, isNumberSticker, MOODS, NUMBER_STICKERS } from '../types/diary';
import {
  defaultStickerForPack,
  entryMoodPack,
  getStoredMoodPackId,
  isNumberPack,
  useMoodPackId,
} from '../utils/moodPack';
import type { CharacterProfile } from '../types/character';
import CalendarPopup from '../components/CalendarPopup';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import MoodIcon from '../components/MoodIcon';
import { HAIR_STYLE_OPTIONS } from '../types/character';
import { generateDiaryImage } from '../api/aiImage';
import AppModal from '../components/AppModal';
import { formatDate, today } from '../utils/date';
import { diaryFontStack, findFont, fontSizeCss, getPreferredFontId, getPreferredFontSizeId, parseFontSizeId } from '../utils/fonts';
import {
  AI_REWARD_AD_ENABLED,
  consumeAiDrawCredit,
  consumeFreeAiDrawChance,
  getAiDrawCredits,
  getDiaryAccessState,
  getRemainingFreeAiDrawsToday,
  grantAiDrawCredits,
} from '../utils/diaryAccess';
import {
  isAiCoachSeen,
  isCharacterCoachSeen,
  isCharacterSetupDone,
  markAiCoachSeen,
  markCharacterCoachSeen,
} from '../utils/onboarding';
import { clearWriteDraft } from '../utils/writeDraft';
import { isFlutterApp, requestAiRewardedAd } from '../utils/nativeShare';
import { requestSubscriptionPurchase } from '../utils/subscription';
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
  entriesCount: number;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onOpenCharacter: () => void;
  /** 작성 한도 초과 시 구독 모달 (프리미엄 월 한도 등) */
  onOpenWriteLimitModal?: () => void;
  /** Flutter AppBar 저장 버튼 활성 상태 */
  onNativeSaveStateChange?: (enabled: boolean) => void;
  writeQuota?: { used: number; limit: number };
}

function DiaryWritePage({
  character,
  initialEntry,
  entriesCount,
  onSave,
  onCancel,
  onOpenCharacter,
  onOpenWriteLimitModal,
  onNativeSaveStateChange,
  writeQuota,
}: DiaryWritePageProps) {
  const { t, i18n } = useTranslation();
  const isEdit = Boolean(initialEntry);
  const globalPack = useMoodPackId();
  const writePackId = isEdit ? entryMoodPack(initialEntry) : globalPack;
  const [date, setDate] = useState(initialEntry?.date ?? today());
  const [title, setTitle] = useState(initialEntry?.title ?? '');
  const [content, setContent] = useState(initialEntry?.content ?? '');
  const [mood, setMood] = useState<DiarySticker>(
    () => initialEntry?.mood ?? defaultStickerForPack(getStoredMoodPackId()),
  );
  const [fontId, setFontId] = useState(
    () => initialEntry?.fontId ?? getPreferredFontId(),
  );
  const [fontSizeId, setFontSizeId] = useState(
    () => parseFontSizeId(initialEntry?.fontSize ?? getPreferredFontSizeId()),
  );
  const [canvasCollapsed, setCanvasCollapsed] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [aiLottiePool, setAiLottiePool] = useState<object[]>([]);
  const [activeAiLottie, setActiveAiLottie] = useState<object | null>(null);
  const [aiLottieKey, setAiLottieKey] = useState(0);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const [rewardPromptOpen, setRewardPromptOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const drawingTouchedRef = useRef(false);
  const baselineRef = useRef({
    date: initialEntry?.date ?? today(),
    title: initialEntry?.title ?? '',
    content: initialEntry?.content ?? '',
    mood: (initialEntry?.mood ?? defaultStickerForPack(getStoredMoodPackId())) as DiarySticker,
    fontId: initialEntry?.fontId ?? getPreferredFontId(),
    fontSizeId: parseFontSizeId(initialEntry?.fontSize ?? getPreferredFontSizeId()),
    hadImage: Boolean(initialEntry?.imageUrl),
  });
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
    if (isEdit) return;
    setFontId(getPreferredFontId());
  }, [i18n.language, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    setMood((prev) => {
      if (isNumberPack(writePackId)) return isNumberSticker(prev) ? prev : '10';
      return isMood(prev) ? prev : 'happy';
    });
  }, [writePackId, isEdit]);

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
    // 수정 모드: 사진 레이어로 올려 클릭 시 확대·취소·삭제 가능하게
    void canvasRef.current?.loadEditableImage(src).catch(() => {
      void canvasRef.current?.loadImage(src);
    });
  }, [initialEntry?.imageUrl]);

  const leaveWithoutSaving = () => {
    if (!isEdit) clearWriteDraft();
    setLeaveConfirmOpen(false);
    onCancel();
  };

  const isDirty = () => {
    const b = baselineRef.current;
    if (date !== b.date) return true;
    if (title !== b.title) return true;
    if (content !== b.content) return true;
    if (mood !== b.mood) return true;
    if (fontId !== b.fontId) return true;
    if (fontSizeId !== b.fontSizeId) return true;
    if (drawingTouchedRef.current) return true;
    const hasDrawing = Boolean(canvasRef.current?.hasContent());
    if (!isEdit && hasDrawing) return true;
    if (isEdit && hasDrawing !== b.hadImage) return true;
    return false;
  };

  const handleCancel = () => {
    if (leaveConfirmOpen) {
      setLeaveConfirmOpen(false);
      return;
    }
    if (aiLoading) return;
    if (isDirty()) {
      setLeaveConfirmOpen(true);
      return;
    }
    leaveWithoutSaving();
  };

  const handleCancelRef = useRef(handleCancel);
  handleCancelRef.current = handleCancel;

  useEffect(() => {
    const onNativeCancel = () => handleCancelRef.current();
    window.addEventListener('diary-write-cancel', onNativeCancel);
    return () => window.removeEventListener('diary-write-cancel', onNativeCancel);
  }, []);

  const saveAndLeave = () => {
    formRef.current?.requestSubmit();
  };

  const handleAiDraw = () => {
    if (!content.trim()) {
      setAiError(t('write.err.aiNeedContent'));
      return;
    }
    if (canvasRef.current?.hasContent()) {
      setReplaceConfirmOpen(true);
      return;
    }
    if (AI_REWARD_AD_ENABLED) {
      const access = getDiaryAccessState();
      if (!access.isPremiumActive && getAiDrawCredits() <= 0) {
        setRewardPromptOpen(true);
        return;
      }
    }
    void runAiDraw();
  };

  const runAiDraw = async () => {
    setReplaceConfirmOpen(false);
    if (AI_REWARD_AD_ENABLED) {
      const access = getDiaryAccessState();
      if (!access.isPremiumActive) {
        if (getRemainingFreeAiDrawsToday() <= 0) {
          setAiError(t('write.err.aiDailyLimit'));
          return;
        }
        if (!consumeAiDrawCredit()) {
          setRewardPromptOpen(true);
          return;
        }
        if (!consumeFreeAiDrawChance()) {
          setAiError(t('write.err.aiDailyLimit'));
          return;
        }
      }
    }
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
      drawingTouchedRef.current = true;
      dismissAiCoach();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('write.err.aiFailed'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (!isFlutterApp()) {
      setAiError(t('write.err.adAppOnly'));
      return;
    }
    if (getRemainingFreeAiDrawsToday() <= 0) {
      setRewardPromptOpen(false);
      setAiError(t('write.err.aiDailyLimit'));
      return;
    }
    setRewardPromptOpen(false);
    setAiError(null);
    const ok = await requestAiRewardedAd();
    if (!ok) {
      setAiError(t('write.err.adNotCompleted'));
      return;
    }
    grantAiDrawCredits(1);
    void runAiDraw();
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

    // 프리미엄 월 한도만 저장 차단. 무료 회원은 저장 제한 없음.
    if (!isEdit) {
      const status = getDiaryAccessState(entriesCount);
      if (status.isPremiumActive && !status.canCreate) {
        onOpenWriteLimitModal?.();
        return;
      }
    }

    setAiError(null);
    clearWriteDraft();
    onSave({
      date,
      title: title.trim(),
      content: content.trim(),
      mood,
      moodPack: writePackId,
      fontId,
      fontSize: fontSizeId,
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
          <span className="diary-write__nav-title">
            {isEdit ? t('write.title.edit') : t('write.title.new')}
            {!isEdit && writeQuota ? (
              <span className="diary-write__quota">
                {t('quota.fraction', {
                  used: Math.min(writeQuota.limit, writeQuota.used + 1),
                  limit: writeQuota.limit,
                })}
              </span>
            ) : null}
          </span>
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
        className={`diary-write__paper${canvasCollapsed ? ' diary-write__paper--canvas-collapsed' : ''}`}
        style={{
          ['--diary-font' as string]: diaryFontStack(findFont(fontId).family),
          ['--diary-font-size' as string]: fontSizeCss(fontSizeId),
        }}
      >
        <div className="diary-write__meta">
          <button
            type="button"
            className="diary-write__date"
            onClick={() => setCalendarOpen((open) => !open)}
          >
            {formatDate(date)}
          </button>
          {!isEdit && writeQuota ? (
            <span className="diary-write__quota-chip">
              {t('quota.fraction', {
                used: Math.min(writeQuota.limit, writeQuota.used + 1),
                limit: writeQuota.limit,
              })}
            </span>
          ) : null}
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
            {isNumberPack(writePackId)
              ? NUMBER_STICKERS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={mood === n ? 'selected' : ''}
                    title={n}
                    onClick={() => setMood(n)}
                  >
                    <MoodIcon mood={n} packId={writePackId} />
                  </button>
                ))
              : MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={mood === m.value ? 'selected' : ''}
                    title={t(`mood.${m.value}`)}
                    onClick={() => setMood(m.value)}
                  >
                    <MoodIcon mood={m.value} packId={writePackId} />
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
            <button
              type="button"
              className="diary-write__canvas-fold"
              onClick={() => {
                setCanvasCollapsed((open) => !open);
                if (!canvasCollapsed) setTipOpen(false);
              }}
              aria-expanded={!canvasCollapsed}
              aria-label={canvasCollapsed ? t('write.expandCanvas') : t('write.collapseCanvas')}
              title={canvasCollapsed ? t('write.expandCanvas') : t('write.collapseCanvas')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {canvasCollapsed ? (
                  <polyline points="6 9 12 15 18 9" />
                ) : (
                  <polyline points="6 15 12 9 18 15" />
                )}
              </svg>
            </button>
          </div>

          <div className="diary-write__draw">
            <div className="diary-write__canvas-wrap">
            <DrawingCanvas
              ref={canvasRef}
              fontId={fontId}
              onFontIdChange={setFontId}
              fontSizeId={fontSizeId}
              onFontSizeChange={setFontSizeId}
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
      {leaveConfirmOpen && (
        <AppModal
          title={t('write.confirm.saveOnLeave')}
          onDismiss={() => setLeaveConfirmOpen(false)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('write.confirm.saveOnLeaveDiscard')}
          onSecondary={leaveWithoutSaving}
          primaryLabel={isEdit ? t('write.saveEdit') : t('write.save')}
          onPrimary={saveAndLeave}
        />
      )}
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
      {rewardPromptOpen && (
        <AppModal
          title={t('write.ai.rewardTitle')}
          lead={t('write.ai.rewardLead')}
          onDismiss={() => setRewardPromptOpen(false)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('subscription.subscribeCta')}
          onSecondary={() => {
            setRewardPromptOpen(false);
            requestSubscriptionPurchase();
          }}
          primaryLabel={t('write.ai.rewardCta')}
          onPrimary={() => void handleWatchAd()}
        />
      )}
    </form>
  );
}

export default DiaryWritePage;
