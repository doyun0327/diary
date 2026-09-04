import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry, DiarySticker, DiaryCanvasState } from '../types/diary';
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
import { generateDiaryImage, type AiProgress } from '../api/aiImage';
import AppModal from '../components/AppModal';
import { formatDate, today } from '../utils/date';
import { diaryFontStack, findFont, fontSizeCss, getPreferredFontId, getPreferredFontSizeId, parseFontSizeId } from '../utils/fonts';
import {
  AI_REWARD_AD_ENABLED,
  applyMonthlyUsageFromServer,
  canUseProAiQuota,
  consumeAiDrawDailyQuota,
  consumeProAiDrawQuota,
  FREE_DAILY_AI_AD_LIMIT,
  getAiDrawsToday,
  grantAiDrawCreditWithDailyCap,
  isAiDailyLimitReached,
  isProAiMonthlyLimitReached,
  needsAiAdBeforeDraw,
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
import { isFlutterApp, requestAiRewardedAd } from '../utils/nativeShare';
import { requestSubscriptionPurchaseAndSync } from '../utils/subscription';
import { getAccessToken } from '../hooks/useAuthSession';
import { consumeMonthlyUsage, fetchMonthlyUsage } from '../api/usageApi';
import './DiaryWritePage.css';

const AI_LOTTIE_URLS = ['/lottie/ai-loading.json', '/lottie/ai-loading-cat.json'] as const;

type AiPickOption = {
  src: string;
  kind: 'canvas' | 'ai';
  aiIndex?: number;
  /** 예전 그림 — 스티커/펜 레이어 원본. 있으면 loadCanvasState로 복원 */
  canvasState?: DiaryCanvasState | null;
};

function cloneCanvasState(state: DiaryCanvasState | null | undefined): DiaryCanvasState | null {
  if (!state) return null;
  try {
    return JSON.parse(JSON.stringify(state)) as DiaryCanvasState;
  } catch {
    return null;
  }
}

function buildAiPickOptions(
  previousSnapshot: string | null,
  aiHistory: string[],
  includePreviousCanvas: boolean,
  previousCanvasState?: DiaryCanvasState | null,
): AiPickOption[] {
  const seen = new Set<string>();
  const options: AiPickOption[] = [];

  const add = (
    src: string,
    kind: 'canvas' | 'ai',
    aiIndex?: number,
    canvasState?: DiaryCanvasState | null,
  ) => {
    if (seen.has(src)) return;
    seen.add(src);
    options.push({ src, kind, aiIndex, canvasState });
  };

  if (includePreviousCanvas && previousSnapshot) {
    add(previousSnapshot, 'canvas', undefined, previousCanvasState ?? null);
  }
  aiHistory.forEach((src, index) => add(src, 'ai', index + 1));
  return options;
}

function pickRandomLottie(pool: object[]): object | null {
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function scrollWritingFieldIntoView(el: HTMLElement | null) {
  if (!el) return;
  const run = () => {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  requestAnimationFrame(() => {
    window.setTimeout(run, 320);
  });
}

/** 본문 높이 = 글 줄 수 (+ 입력 중일 때만 빈 줄 1줄) */
function syncContentTextareaHeight(
  el: HTMLTextAreaElement | null,
  options?: { extraBlankLine?: boolean },
) {
  if (!el) return;
  const lh = Number.parseFloat(getComputedStyle(el).lineHeight);
  if (!Number.isFinite(lh) || lh <= 0) return;
  el.style.removeProperty('height');
  const contentHeight = el.scrollHeight;
  const extra = options?.extraBlankLine ? lh : 0;
  el.style.height = `${contentHeight + extra}px`;
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
  onNativeSaveStateChange?: (enabled: boolean, saving?: boolean) => void;
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
  const [aiProgress, setAiProgress] = useState<AiProgress>('waiting');
  const [aiError, setAiError] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [aiLottiePool, setAiLottiePool] = useState<object[]>([]);
  const [activeAiLottie, setActiveAiLottie] = useState<object | null>(null);
  const [aiLottieKey, setAiLottieKey] = useState(0);
  const [rewardPromptOpen, setRewardPromptOpen] = useState(false);
  const [aiDailyLimitOpen, setAiDailyLimitOpen] = useState(false);
  const [proAiLimitOpen, setProAiLimitOpen] = useState(false);
  const [adIncompleteOpen, setAdIncompleteOpen] = useState(false);
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [aiPickOpen, setAiPickOpen] = useState(false);
  const [aiGeneratedImages, setAiGeneratedImages] = useState<string[]>([]);
  const [aiPickOptions, setAiPickOptions] = useState<AiPickOption[]>([]);
  const [aiPickSelected, setAiPickSelected] = useState<Set<number>>(() => new Set());
  const [accessTick, setAccessTick] = useState(0);
  const [purchaseClickShield, setPurchaseClickShield] = useState(false);
  const proPurchaseGuardUntilRef = useRef(0);
  const purchaseShieldTimerRef = useRef<number | null>(null);

  const armPurchaseShield = useCallback((ms = 8_000) => {
    proPurchaseGuardUntilRef.current = Date.now() + ms;
    setPurchaseClickShield(true);
    contentRef.current?.blur();
    titleRef.current?.blur();
    if (purchaseShieldTimerRef.current != null) {
      window.clearTimeout(purchaseShieldTimerRef.current);
    }
    purchaseShieldTimerRef.current = window.setTimeout(() => {
      purchaseShieldTimerRef.current = null;
      if (Date.now() >= proPurchaseGuardUntilRef.current) {
        setPurchaseClickShield(false);
      }
    }, ms);
  }, []);

  const isPurchaseShielded = useCallback(
    () => purchaseClickShield || Date.now() < proPurchaseGuardUntilRef.current,
    [purchaseClickShield],
  );

  const startProPurchase = useCallback(() => {
    armPurchaseShield();
    setRewardPromptOpen(false);
    setAiDailyLimitOpen(false);
    setAdIncompleteOpen(false);
    setAiConfirmOpen(false);
    setAiError(null);
    setAiLoading(false);
    contentRef.current?.blur();
    titleRef.current?.blur();
    void requestSubscriptionPurchaseAndSync().finally(() => {
      armPurchaseShield(6_000);
    });
  }, [armPurchaseShield]);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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
  const paperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  /** 수정 모드 — AI 선택지에 넣을 원본 그림 (캔버스 로드 전에도 사용) */
  const editOriginalImageRef = useRef<string | null>(initialEntry?.imageUrl ?? null);
  /** AI 직전 캔버스 레이어 스냅샷 — 예전 그림 선택 시 PNG 합성이 아닌 원본 복원 */
  const previousCanvasStateRef = useRef<DiaryCanvasState | null>(
    cloneCanvasState(initialEntry?.canvasState),
  );

  useEffect(() => {
    savingRef.current = saving;
    onNativeSaveStateChange?.(!aiLoading && !saving, saving);
  }, [aiLoading, saving, onNativeSaveStateChange]);

  useEffect(() => {
    editOriginalImageRef.current = initialEntry?.imageUrl ?? null;
    previousCanvasStateRef.current = cloneCanvasState(initialEntry?.canvasState);
    setAiGeneratedImages([]);
    setAiPickOptions([]);
    setAiPickSelected(new Set());
    setAiPickOpen(false);
  }, [initialEntry?.id, initialEntry?.imageUrl, initialEntry?.canvasState]);

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
    const onNativeSave = () => {
      if (savingRef.current || aiLoading) return;
      formRef.current?.requestSubmit();
    };
    window.addEventListener('diary-write-save', onNativeSave);
    return () => window.removeEventListener('diary-write-save', onNativeSave);
  }, [aiLoading]);

  useEffect(() => {
    const vv = window.visualViewport;
    const paper = paperRef.current;
    if (!vv || !paper) return;

    const syncKeyboardInset = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      paper.style.setProperty('--diary-keyboard-inset', `${inset}px`);
    };

    vv.addEventListener('resize', syncKeyboardInset);
    vv.addEventListener('scroll', syncKeyboardInset);
    syncKeyboardInset();

    return () => {
      vv.removeEventListener('resize', syncKeyboardInset);
      vv.removeEventListener('scroll', syncKeyboardInset);
      paper.style.removeProperty('--diary-keyboard-inset');
    };
  }, []);

  useLayoutEffect(() => {
    syncContentTextareaHeight(contentRef.current);
  }, [content, fontId, fontSizeId]);

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
    if (aiLoading || saving) return;
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

  useEffect(() => {
    return () => {
      if (purchaseShieldTimerRef.current != null) {
        window.clearTimeout(purchaseShieldTimerRef.current);
      }
    };
  }, []);

  // Pro 결제 반영되면 AI 광고 팝업 즉시 닫기 + 남은 횟수 갱신
  useEffect(() => {
    return subscribeDiaryAccess(() => {
      setAccessTick((n) => n + 1);
      if (canUseProAiQuota()) {
        setRewardPromptOpen(false);
        setAiDailyLimitOpen(false);
        proPurchaseGuardUntilRef.current = 0;
        setPurchaseClickShield(false);
      }
    });
  }, []);

  // 네이티브 결제창 닫힘 직후 잠깐 뜨는 팝업/로딩·유령 터치 방지
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        armPurchaseShield();
        return;
      }
      if (Date.now() > proPurchaseGuardUntilRef.current) return;
      armPurchaseShield(6_000);
      setRewardPromptOpen(false);
      setAiDailyLimitOpen(false);
      setAdIncompleteOpen(false);
      setAiConfirmOpen(false);
      setAiLoading(false);
      setAiError(null);
      contentRef.current?.blur();
      titleRef.current?.blur();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [armPurchaseShield]);

  const saveAndLeave = () => {
    formRef.current?.requestSubmit();
  };

  const aiQuota = (() => {
    void accessTick;
    if (writeQuota) {
      return {
        used: writeQuota.used,
        limit: writeQuota.limit,
      };
    }
    return {
      used: getAiDrawsToday(),
      limit: FREE_DAILY_AI_AD_LIMIT,
    };
  })();
  const aiLeft = Math.max(0, aiQuota.limit - aiQuota.used);

  const promptAiDrawBlocked = () => {
    if (isPurchaseShielded()) return;
    if (isAiDailyLimitReached()) {
      setAiDailyLimitOpen(true);
      return;
    }
    if (AI_REWARD_AD_ENABLED) {
      setRewardPromptOpen(true);
      return;
    }
    setAiError(t('write.err.aiDailyLimit'));
  };

  const promptProAiLimit = () => {
    setProAiLimitOpen(true);
  };

  const consumeAiDrawQuota = async () => {
    if (canUseProAiQuota()) {
      if (isProAiMonthlyLimitReached()) {
        promptProAiLimit();
        return false;
      }
      const token = getAccessToken();
      if (token) {
        try {
          const usage = await consumeMonthlyUsage(token);
          applyMonthlyUsageFromServer(usage.used, usage.yearMonth);
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('409')) {
            try {
              const usage = await fetchMonthlyUsage(token);
              applyMonthlyUsageFromServer(usage.used, usage.yearMonth);
            } catch {
              // ignore
            }
            promptProAiLimit();
            return false;
          }
          if (!consumeProAiDrawQuota()) {
            promptProAiLimit();
            return false;
          }
          return true;
        }
      }
      if (!consumeProAiDrawQuota()) {
        promptProAiLimit();
        return false;
      }
      return true;
    }
    if (!consumeAiDrawDailyQuota()) {
      promptAiDrawBlocked();
      return false;
    }
    return true;
  };

  const handleAiDraw = () => {
    if (isPurchaseShielded()) return;
    if (!content.trim()) {
      setAiError(t('write.err.aiNeedContent'));
      return;
    }
    if (canUseProAiQuota()) {
      if (isProAiMonthlyLimitReached()) {
        promptProAiLimit();
        return;
      }
      void runAiDraw();
      return;
    }
    if (isAiDailyLimitReached()) {
      promptAiDrawBlocked();
      return;
    }
    if (needsAiAdBeforeDraw()) {
      if (!isFlutterApp()) {
        setAiError(t('write.err.adAppOnly'));
        return;
      }
      setRewardPromptOpen(true);
      return;
    }
    void runAiDraw();
  };

  const capturePreviousSnapshot = async (): Promise<{
    preview: string | null;
    canvasState: DiaryCanvasState | null;
  }> => {
    if (canvasRef.current?.hasContent()) {
      await canvasRef.current.prepareExport();
      const canvasState = cloneCanvasState(canvasRef.current.getCanvasState());
      const preview = canvasRef.current.toDataURL() ?? null;
      return { preview, canvasState };
    }
    return {
      preview: editOriginalImageRef.current ?? initialEntry?.imageUrl ?? null,
      canvasState: cloneCanvasState(
        previousCanvasStateRef.current ?? initialEntry?.canvasState,
      ),
    };
  };

  const runAiDraw = async () => {
    if (isPurchaseShielded()) return;
    setAiError(null);
    if (!(await consumeAiDrawQuota())) return;

    setAiProgress('waiting');
    setActiveAiLottie(pickRandomLottie(aiLottiePool));
    setAiLottieKey((key) => key + 1);
    setAiLoading(true);

    try {
      const { preview: previousSnapshot, canvasState: previousState } =
        await capturePreviousSnapshot();
      previousCanvasStateRef.current = previousState;

      const { imageUrl } = await generateDiaryImage({
        title,
        content,
        character,
        onProgress: setAiProgress,
      });

      const priorAiCount = aiGeneratedImages.length;
      const nextHistory = [...aiGeneratedImages, imageUrl];
      setAiGeneratedImages(nextHistory);

      if (nextHistory.length === 1 && !previousSnapshot) {
        await canvasRef.current?.loadImage(imageUrl);
        drawingTouchedRef.current = true;
        dismissAiCoach();
      } else {
        const options = buildAiPickOptions(
          previousSnapshot,
          nextHistory,
          priorAiCount === 0,
          previousState,
        );
        setAiPickOptions(options);
        setAiPickSelected(new Set(options.map((_, index) => index)));
        setAiPickOpen(true);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('write.err.aiFailed'));
    } finally {
      setAiLoading(false);
    }
  };

  const dismissAiPick = () => {
    setAiPickOpen(false);
    setAiPickOptions([]);
    setAiPickSelected(new Set());
  };

  const toggleAiPick = (index: number) => {
    setAiPickSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const applyAiPick = async () => {
    if (aiPickOptions.length === 0) {
      dismissAiPick();
      return;
    }
    if (aiPickSelected.size === 0) {
      setAiError(t('write.ai.pickSelectOne'));
      return;
    }

    const selected = [...aiPickSelected]
      .sort((a, b) => a - b)
      .map((index) => aiPickOptions[index])
      .filter((option): option is AiPickOption => Boolean(option));
    dismissAiPick();

    const canvasOption = selected.find((option) => option.kind === 'canvas');
    const aiSrcs = selected
      .filter((option) => option.kind === 'ai')
      .map((option) => option.src)
      .filter(Boolean);

    try {
      // 이전 그림만 선택 → 캔버스는 AI 생성 전 상태 그대로 (재로드/합성 PNG 금지)
      if (canvasOption && aiSrcs.length === 0) {
        dismissAiCoach();
        return;
      }

      if (canvasOption && aiSrcs.length > 0) {
        // 이전 그림은 이미 캔버스에 있음 → AI만 추가
        if (!canvasRef.current?.hasContent() && canvasOption.src) {
          const restoreState =
            canvasOption.canvasState ?? previousCanvasStateRef.current;
          if (restoreState) {
            await canvasRef.current?.loadCanvasState(
              restoreState,
              canvasOption.src,
            );
          } else {
            await canvasRef.current?.loadEditableImage(canvasOption.src);
          }
        }
        await canvasRef.current?.appendImages(aiSrcs);
      } else if (aiSrcs.length === 1) {
        await canvasRef.current?.loadImage(aiSrcs[0]);
      } else if (aiSrcs.length > 1) {
        await canvasRef.current?.loadImages(aiSrcs);
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
    if (isAiDailyLimitReached()) {
      setRewardPromptOpen(false);
      setAiDailyLimitOpen(true);
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
    if (!grantAiDrawCreditWithDailyCap(1)) {
      setAiDailyLimitOpen(true);
      return;
    }
    void runAiDraw();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || aiLoading) return;
    setSaving(true);
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
      setSaving(false);
      return;
    }
    if (!title.trim() && !content.trim() && !imageUrl) {
      setAiError(t('write.err.empty'));
      setSaving(false);
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
    } finally {
      setSaving(false);
    }
  };

  const handleTitleFocus = () => {
    if (isPurchaseShielded()) {
      titleRef.current?.blur();
      return;
    }
    scrollWritingFieldIntoView(titleRef.current);
  };

  const handleContentFocus = () => {
    if (isPurchaseShielded()) {
      contentRef.current?.blur();
      return;
    }
    scrollWritingFieldIntoView(contentRef.current);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    syncContentTextareaHeight(e.target, { extraBlankLine: true });
  };

  const aiStatusKey =
    aiProgress === 'waiting'
      ? 'write.ai.statusWaiting'
      : aiProgress === 'drawing'
        ? 'write.ai.statusDrawing'
        : 'write.ai.statusFinishing';
  const aiLabel = aiLoading ? t(aiStatusKey) : t('write.ai.button');

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
            disabled={aiLoading || saving}
          >
            {saving
              ? isEdit
                ? t('write.savingEdit')
                : t('write.saving')
              : isEdit
                ? t('write.saveEdit')
                : t('write.save')}
          </button>
        </nav>
      )}

      <div
        ref={paperRef}
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
              ref={titleRef}
              type="text"
              className="diary-write__title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={handleTitleFocus}
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
            {aiLoading && !purchaseClickShield && (
              <AiLoadingWait
                animationData={activeAiLottie}
                lottieKey={aiLottieKey}
                step={aiProgress}
                sourceText={content}
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
                    <span className="diary-write__ai-remaining">
                      {aiLeft}
                    </span>
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
            ref={contentRef}
            className="diary-write__content"
            value={content}
            onChange={handleContentChange}
            onFocus={handleContentFocus}
            placeholder={t('write.contentPlaceholder')}
          />
          {aiError && <p className="diary-write__ai-error">{aiError}</p>}
        </section>
      </div>
      {createPortal(
        <>
          {purchaseClickShield && (
            <div className="diary-write__purchase-shield" aria-hidden="true" />
          )}
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
              lead={String(aiLeft)}
              onDismiss={() => setAiConfirmOpen(false)}
              showClose={false}
              closeAriaLabel={t('common.close')}
              secondaryLabel={t('common.cancel')}
              onSecondary={() => setAiConfirmOpen(false)}
              primaryLabel={t('quota.drawConfirmOk')}
              onPrimary={() => {
                setAiConfirmOpen(false);
                void runAiDraw();
              }}
            />
          )}
          {rewardPromptOpen && (
            <AppModal
              title={t('write.ai.rewardTitle')}
              lead={t('write.ai.rewardLeadDaily')}
              onDismiss={() => setRewardPromptOpen(false)}
              showClose={false}
              closeAriaLabel={t('common.close')}
              secondaryLabel={t('subscription.subscribeCta')}
              onSecondary={startProPurchase}
              primaryLabel={t('write.ai.rewardCta')}
              onPrimary={() => void handleWatchAd()}
            />
          )}
          {aiDailyLimitOpen && (
            <AppModal
              title={t('write.ai.rewardTitle')}
              lead={t('write.err.aiDailyLimit')}
              onDismiss={() => setAiDailyLimitOpen(false)}
              showClose={false}
              closeAriaLabel={t('common.close')}
              primaryLabel={t('subscription.subscribeCta')}
              onPrimary={startProPurchase}
            />
          )}
          {proAiLimitOpen && (
            <AppModal
              title={t('write.ai.monthlyLimitTitle')}
              lead={t('write.err.aiMonthlyLimit')}
              onDismiss={() => setProAiLimitOpen(false)}
              showClose={false}
              closeAriaLabel={t('common.close')}
              primaryLabel={t('common.close')}
              onPrimary={() => setProAiLimitOpen(false)}
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
          {aiPickOpen && aiPickOptions.length > 0 && (
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
                {aiPickOptions.map((option, index) => {
                  const checked = aiPickSelected.has(index);
                  return (
                    <button
                      key={`${option.kind}-${index}-${option.src.slice(0, 32)}`}
                      type="button"
                      className={`diary-write__ai-pick-item${checked ? ' diary-write__ai-pick-item--selected' : ''}`}
                      aria-pressed={checked}
                      onClick={() => toggleAiPick(index)}
                    >
                      <img src={option.src} alt="" className="diary-write__ai-pick-thumb" />
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
        </>,
        document.getElementById('root') ?? document.body,
      )}
    </form>
  );
}

export default DiaryWritePage;
