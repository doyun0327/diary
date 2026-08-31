import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
import AiLoadingWait from '../components/AiLoadingWait';
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
  FREE_AI_DRAWS_TOTAL,
  consumeAiDrawCredit,
  consumeFreeAiDrawChance,
  getAiDrawCredits,
  getDiaryAccessState,
  getRemainingFreeAiDraws,
  grantAiDrawCredits,
  subscribeDiaryAccess,
} from '../utils/diaryAccess';
import {
  isAiCoachSeen,
  isCharacterCoachSeen,
  isCharacterSetupDone,
  markAiCoachSeen,
  markCharacterCoachSeen,
} from '../utils/onboarding';
import { clearWriteDraft } from '../utils/writeDraft';
import { resolveDiaryImageForSave, resolveInkImageForSave } from '../utils/resolveDiaryImage';
import type { DiaryCanvasState } from '../types/diary';
import { isFlutterApp, requestAiRewardedAd } from '../utils/nativeShare';
import { requestSubscriptionPurchaseAndSync } from '../utils/subscription';
import './DiaryWritePage.css';

const AI_LOTTIE_URLS = ['/lottie/ai-loading.json', '/lottie/ai-loading-cat.json'] as const;

function pickRandomLottie(pool: object[]): object | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
interface DiaryWritePageProps {
  character: CharacterProfile;
  /** 있으면 수정 모드 */
  initialEntry?: DiaryEntry;
  onSave: (
    entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void | Promise<void>;
  onCancel: () => void;
  onOpenCharacter: () => void;
  /** Flutter AppBar 저장 버튼 활성 상태 */
  onNativeSaveStateChange?: (enabled: boolean) => void;
  writeQuota?: { used: number; limit: number };
}

function DiaryWritePage({
  character,
  initialEntry,
  onSave,
  onCancel,
  onOpenCharacter,
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
  const [rewardPromptOpen, setRewardPromptOpen] = useState(false);
  const [adIncompleteOpen, setAdIncompleteOpen] = useState(false);
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [aiPickOpen, setAiPickOpen] = useState(false);
  const [aiPickPrevious, setAiPickPrevious] = useState<string | null>(null);
  const [aiPickNew, setAiPickNew] = useState<string | null>(null);
  const [aiPickSelected, setAiPickSelected] = useState<Set<'previous' | 'new'>>(
    () => new Set(['previous', 'new']),
  );
  const [accessTick, setAccessTick] = useState(0);
  void accessTick;
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
    const state = initialEntry?.canvasState;
    const src = initialEntry?.imageUrl;
    if (!state && !src) return;
    let cancelled = false;
    let attempts = 0;

    const tryLoad = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        if (attempts++ < 90) {
          window.requestAnimationFrame(tryLoad);
        }
        return;
      }
      const hasLayers = Boolean(
        state &&
          ((state.photos?.length ?? 0) > 0 ||
            (state.stickers?.length ?? 0) > 0 ||
            state.inkUrl),
      );
      if (hasLayers && state) {
        void canvas.loadCanvasState(state, src).catch(() => {
          if (!cancelled && src) void canvas.loadEditableImage(src);
        });
        return;
      }
      if (src) {
        void canvas.loadEditableImage(src).catch(() => {
          if (!cancelled) void canvas.loadImage(src);
        });
      }
    };

    tryLoad();
    return () => {
      cancelled = true;
    };
  }, [initialEntry?.imageUrl, initialEntry?.canvasState]);

  const resolveCanvasStateForSave = async (
    state: DiaryCanvasState | null,
  ): Promise<DiaryCanvasState | undefined> => {
    if (!state) return undefined;
    const photos = [];
    for (const p of state.photos) {
      const src = await resolveDiaryImageForSave(p.src);
      if (!src) continue;
      photos.push({ ...p, src });
    }
    // 잉크는 trim/JPEG 금지 — 투명 PNG 유지
    const inkUrl = state.inkUrl
      ? await resolveInkImageForSave(state.inkUrl)
      : undefined;
    if (photos.length === 0 && state.stickers.length === 0 && !inkUrl) {
      return undefined;
    }
    return {
      viewWidth: state.viewWidth,
      viewHeight: state.viewHeight,
      normalized: state.normalized ?? true,
      photos,
      stickers: state.stickers,
      inkUrl,
    };
  };

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

  // Pro 결제 반영되면 AI 광고 팝업 즉시 닫기 + 남은 횟수 갱신
  useEffect(() => {
    return subscribeDiaryAccess(() => {
      setAccessTick((n) => n + 1);
      if (getDiaryAccessState().isPremiumActive) {
        setRewardPromptOpen(false);
      }
    });
  }, []);

  const saveAndLeave = () => {
    formRef.current?.requestSubmit();
  };

  const aiRemaining = (() => {
    if (writeQuota) {
      return {
        n: Math.max(0, writeQuota.limit - writeQuota.used),
        limit: writeQuota.limit,
      };
    }
    return {
      n: getRemainingFreeAiDraws(),
      limit: FREE_AI_DRAWS_TOTAL,
    };
  })();

  const needsAiRewardAd = () => {
    if (!AI_REWARD_AD_ENABLED) return false;
    const access = getDiaryAccessState();
    if (access.isPremiumActive) return false;
    return getRemainingFreeAiDraws() <= 0 && getAiDrawCredits() <= 0;
  };

  const startAiDrawFlow = () => {
    if (
      AI_REWARD_AD_ENABLED &&
      !getDiaryAccessState().isPremiumActive &&
      getRemainingFreeAiDraws() <= 0 &&
      getAiDrawCredits() <= 0
    ) {
      setRewardPromptOpen(true);
      return;
    }
    void runAiDraw();
  };

  const handleAiDraw = () => {
    if (!content.trim()) {
      setAiError(t('write.err.aiNeedContent'));
      return;
    }
    // 무료 체험·크레딧 소진 시 확인창 없이 바로 광고 안내
    if (needsAiRewardAd()) {
      setRewardPromptOpen(true);
      return;
    }
    // 테스트: 확인창 없이 바로 생성 (광고 스킵은 AI_REWARD_AD_ENABLED=false)
    startAiDrawFlow();
  };

  const runAiDraw = async () => {
    setAiError(null);
    setActiveAiLottie(pickRandomLottie(aiLottiePool));
    setAiLottieKey((key) => key + 1);
    setAiLoading(true);

    try {
      if (AI_REWARD_AD_ENABLED && !getDiaryAccessState().isPremiumActive) {
        const freeLeft = getRemainingFreeAiDraws();
        if (freeLeft > 0) {
          if (!consumeFreeAiDrawChance()) {
            setAiError(t('write.err.aiFreeLimit'));
            return;
          }
        } else if (getAiDrawCredits() > 0) {
          if (!consumeAiDrawCredit()) {
            setRewardPromptOpen(true);
            return;
          }
        } else {
          setRewardPromptOpen(true);
          return;
        }
      }

      let previousSnapshot: string | null = null;
      if (canvasRef.current?.hasContent()) {
        await canvasRef.current.prepareExport();
        previousSnapshot = canvasRef.current.toDataURL() ?? null;
      }

      const { imageUrl } = await generateDiaryImage({
        title,
        content,
        character,
      });

      if (previousSnapshot) {
        setAiPickPrevious(previousSnapshot);
        setAiPickNew(imageUrl);
        setAiPickSelected(new Set(['previous', 'new']));
        setAiPickOpen(true);
      } else {
        await canvasRef.current?.loadImage(imageUrl);
        drawingTouchedRef.current = true;
        dismissAiCoach();
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('write.err.aiFailed'));
    } finally {
      setAiLoading(false);
    }
  };

  const dismissAiPick = () => {
    setAiPickOpen(false);
    setAiPickPrevious(null);
    setAiPickNew(null);
  };

  const toggleAiPick = (choice: 'previous' | 'new') => {
    setAiPickSelected((prev) => {
      const next = new Set(prev);
      if (next.has(choice)) next.delete(choice);
      else next.add(choice);
      return next;
    });
  };

  const applyAiPick = async () => {
    if (!aiPickPrevious || !aiPickNew) {
      dismissAiPick();
      return;
    }
    if (aiPickSelected.size === 0) {
      setAiError(t('write.ai.pickSelectOne'));
      return;
    }

    const selected = [...aiPickSelected];
    dismissAiPick();

    try {
      if (selected.length === 1) {
        const src = selected[0] === 'previous' ? aiPickPrevious : aiPickNew;
        await canvasRef.current?.loadImage(src);
      } else {
        await canvasRef.current?.loadImages([aiPickPrevious, aiPickNew]);
      }
      drawingTouchedRef.current = true;
      dismissAiCoach();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('write.err.aiFailed'));
    }
  };

  const handleWatchAd = async () => {
    if (!isFlutterApp()) {
      setAiError(t('write.err.adAppOnly'));
      return;
    }
    setRewardPromptOpen(false);
    setAdIncompleteOpen(false);
    setAiError(null);
    const ok = await requestAiRewardedAd();
    if (!ok) {
      setAdIncompleteOpen(true);
      return;
    }
    grantAiDrawCredits(1);
    startAiDrawFlow();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let imageUrl: string | undefined;
    let canvasState: DiaryCanvasState | undefined;
    try {
      await canvasRef.current?.prepareExport();
      const rawState = canvasRef.current?.getCanvasState() ?? null;
      canvasState = await resolveCanvasStateForSave(rawState);
      const raw = canvasRef.current?.toDataURL();
      // 친구방 공유·로컬 표시용 합성본 — 8/26처럼 data URL 유지 (GCS 업로드는 sync 시)
      imageUrl = raw || undefined;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('write.err.saveImage'));
      return;
    }
    if (!title.trim() && !content.trim() && !imageUrl) {
      setAiError(t('write.err.empty'));
      return;
    }

    setAiError(null);
    setSaveError(null);
    clearWriteDraft();
    try {
      await onSave({
        date,
        title: title.trim(),
        content: content.trim(),
        mood,
        moodPack: writePackId,
        fontId,
        fontSize: fontSizeId,
        imageUrl,
        canvasState,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : t('write.err.saveFailed'),
      );
    }
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
              <AiLoadingWait
                animationData={activeAiLottie}
                lottieKey={aiLottieKey}
                statusText={t('write.ai.statusDraw')}
              />
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
                    {!isEdit && (
                      <span className="diary-write__ai-remaining" aria-label={t('quota.fraction', { used: aiRemaining.n, limit: aiRemaining.limit })}>
                        {t('quota.fraction', {
                          used: aiRemaining.n,
                          limit: aiRemaining.limit,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
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
      {aiConfirmOpen && (
        <AppModal
          title={t('quota.drawConfirmTitle')}
          lead={t('quota.drawConfirmLead', {
            n: aiRemaining.n,
            limit: aiRemaining.limit,
          })}
          onDismiss={() => setAiConfirmOpen(false)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('common.cancel')}
          onSecondary={() => setAiConfirmOpen(false)}
          primaryLabel={t('quota.drawConfirmOk')}
          onPrimary={() => {
            setAiConfirmOpen(false);
            startAiDrawFlow();
          }}
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
            void requestSubscriptionPurchaseAndSync();
          }}
          primaryLabel={t('write.ai.rewardCta')}
          onPrimary={() => void handleWatchAd()}
        />
      )}
      {adIncompleteOpen && (
        <AppModal
          title={t('write.ai.adIncompleteTitle')}
          lead={t('write.err.adNotCompleted')}
          onDismiss={() => setAdIncompleteOpen(false)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('common.close')}
          onSecondary={() => setAdIncompleteOpen(false)}
          primaryLabel={t('write.ai.rewardCta')}
          onPrimary={() => void handleWatchAd()}
        />
      )}
      {aiPickOpen && aiPickPrevious && aiPickNew && (
        <AppModal
          title={t('write.ai.pickTitle')}
          lead={t('write.ai.pickLead')}
          onDismiss={dismissAiPick}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('common.cancel')}
          onSecondary={dismissAiPick}
          primaryLabel={t('write.ai.pickConfirm')}
          onPrimary={() => void applyAiPick()}
        >
          <div className="diary-write__ai-pick">
            {(['previous', 'new'] as const).map((choice) => {
              const src = choice === 'previous' ? aiPickPrevious : aiPickNew;
              const label =
                choice === 'previous' ? t('write.ai.pickPrevious') : t('write.ai.pickNew');
              const checked = aiPickSelected.has(choice);
              return (
                <button
                  key={choice}
                  type="button"
                  className={`diary-write__ai-pick-item${checked ? ' diary-write__ai-pick-item--selected' : ''}`}
                  aria-pressed={checked}
                  onClick={() => toggleAiPick(choice)}
                >
                  <img src={src} alt="" className="diary-write__ai-pick-thumb" />
                  <span className="diary-write__ai-pick-label">{label}</span>
                  <span className="diary-write__ai-pick-check" aria-hidden="true">
                    {checked ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </AppModal>
      )}
      {saveError && (
        <AppModal
          title={saveError}
          onDismiss={() => setSaveError(null)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          primaryLabel={t('common.close')}
          onPrimary={() => setSaveError(null)}
        />
      )}
    </form>
  );
}

export default DiaryWritePage;
