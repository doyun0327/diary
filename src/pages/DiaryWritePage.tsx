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
  preloadMoodPackIcons,
  useMoodPackId,
} from '../utils/moodPack';
import { GENDER_EMOJI, preloadCharacterHairIcons, type CharacterProfile } from '../types/character';
import AiLoadingWait from '../components/AiLoadingWait';
import CalendarPopup from '../components/CalendarPopup';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import MoodIcon from '../components/MoodIcon';
import { generateDiaryImage, type AiProgress } from '../api/aiImage';
import AppModal from '../components/AppModal';
import { formatDate, today } from '../utils/date';
import { AI_DRAW_STYLES, type AiDrawStyleId } from '../utils/aiDrawStyles';
import { diaryFontStack, findFont, fontSizeCss, getPreferredFontId, getPreferredFontSizeId, parseFontSizeId } from '../utils/fonts';
import {
  AI_REWARD_AD_ENABLED,
  applyAiPackCreditsFromServer,
  applyMonthlyUsageFromServer,
  canUseProAiQuota,
  consumeAiDrawDailyQuota,
  consumeAiPackCredit,
  consumeProAiDrawQuota,
  FREE_DAILY_AI_AD_LIMIT,
  getAiDrawCredits,
  getAiDrawsToday,
  getAiPackCredits,
  getDiaryAccessState,
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
import {
  clearWriteDraft,
  DRAFT_FLUSH_EVENT,
  loadWriteDraft,
  loadWriteDraftMedia,
  saveWriteDraft,
  saveWriteDraftMedia,
  writeDraftHasContent,
} from '../utils/writeDraft';
import { resolveDiaryImageForSave, resolveInkImageForSave } from '../utils/resolveDiaryImage';
import { isFlutterApp, requestAiRewardedAd } from '../utils/nativeShare';
import { openNyangTicket } from '../utils/openNyangTicket';
import { getAccessToken } from '../hooks/useAuthSession';
import {
  consumeAiPackCreditsRemote,
  consumeMonthlyUsage,
  fetchAiPackCredits,
  fetchMonthlyUsage,
} from '../api/usageApi';
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
  /** 저장 토스트와 동일한 app-toast (durationMs 기본 1.8초) */
  onAppToast?: (message: string, durationMs?: number) => void;
}

function DiaryWritePage({
  character,
  initialEntry,
  onSave,
  onCancel,
  onOpenCharacter,
  onNativeSaveStateChange,
  writeQuota,
  onAppToast,
}: DiaryWritePageProps) {
  const { t, i18n } = useTranslation();
  const isEdit = Boolean(initialEntry);
  const resumeDraft = (() => {
    const draft = loadWriteDraft();
    if (!draft || !writeDraftHasContent(draft)) return null;
    if (isEdit) {
      return draft.editingId === initialEntry?.id ? draft : null;
    }
    // 새 글: 수정용 초안이어도 대상 일기가 없으면 내용 복원
    if (draft.editingId && draft.editingId !== '') {
      return draft;
    }
    return draft;
  })();
  const globalPack = useMoodPackId();
  const writePackId = isEdit ? entryMoodPack(initialEntry) : globalPack;
  const [date, setDate] = useState(
    () => resumeDraft?.date ?? initialEntry?.date ?? today(),
  );
  const [title, setTitle] = useState(
    () => resumeDraft?.title ?? initialEntry?.title ?? '',
  );
  const [content, setContent] = useState(
    () => resumeDraft?.content ?? initialEntry?.content ?? '',
  );
  const [mood, setMood] = useState<DiarySticker>(
    () =>
      resumeDraft?.mood ??
      initialEntry?.mood ??
      defaultStickerForPack(getStoredMoodPackId()),
  );
  const [fontId, setFontId] = useState(
    () => resumeDraft?.fontId ?? initialEntry?.fontId ?? getPreferredFontId(),
  );
  const [fontSizeId, setFontSizeId] = useState(
    () =>
      parseFontSizeId(
        resumeDraft?.fontSize ??
          initialEntry?.fontSize ??
          getPreferredFontSizeId(),
      ),
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
  const [aiStyleOpen, setAiStyleOpen] = useState(false);
  const [usageNoticeOpen, setUsageNoticeOpen] = useState(false);
  const [usageNotice, setUsageNotice] = useState('');
  const [usageNoticeKind, setUsageNoticeKind] = useState<'refund' | 'cdn'>('refund');
  const aiStyleRef = useRef<AiDrawStyleId>('storybook');
  const aiQuotaKindRef = useRef<'none' | 'pro-server' | 'pro-local' | 'free' | 'ai-pack'>(
    'none',
  );
  const [aiPickOpen, setAiPickOpen] = useState(false);
  const [aiGeneratedImages, setAiGeneratedImages] = useState<string[]>([]);
  const [aiPickOptions, setAiPickOptions] = useState<AiPickOption[]>([]);
  const [aiPickSelected, setAiPickSelected] = useState<Set<number>>(() => new Set());
  const [accessTick, setAccessTick] = useState(0);
  const [purchaseClickShield, setPurchaseClickShield] = useState(false);
  const proPurchaseGuardUntilRef = useRef(0);
  const purchaseShieldTimerRef = useRef<number | null>(null);

  const clearPurchaseShield = useCallback(() => {
    proPurchaseGuardUntilRef.current = 0;
    setPurchaseClickShield(false);
    if (purchaseShieldTimerRef.current != null) {
      window.clearTimeout(purchaseShieldTimerRef.current);
      purchaseShieldTimerRef.current = null;
    }
  }, []);

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

  const showAiRetryToast = useCallback(() => {
    setAiError(null);
    onAppToast?.(t('write.err.aiRetry'));
  }, [onAppToast, t]);

  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const drawingTouchedRef = useRef(false);
  const baselineRef = useRef({
    date: resumeDraft?.date ?? initialEntry?.date ?? today(),
    title: resumeDraft?.title ?? initialEntry?.title ?? '',
    content: resumeDraft?.content ?? initialEntry?.content ?? '',
    mood: (resumeDraft?.mood ??
      initialEntry?.mood ??
      defaultStickerForPack(getStoredMoodPackId())) as DiarySticker,
    fontId: resumeDraft?.fontId ?? initialEntry?.fontId ?? getPreferredFontId(),
    fontSizeId: parseFontSizeId(
      resumeDraft?.fontSize ??
        initialEntry?.fontSize ??
        getPreferredFontSizeId(),
    ),
    hadImage:
      Boolean(initialEntry?.imageUrl) || Boolean(resumeDraft?.hasDrawing),
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
    if (resumeDraft?.fontId) return;
    setFontId(getPreferredFontId());
  }, [i18n.language, isEdit, resumeDraft?.fontId]);

  useEffect(() => {
    if (isEdit) return;
    setMood((prev) => {
      if (isNumberPack(writePackId)) return isNumberSticker(prev) ? prev : '10';
      return isMood(prev) ? prev : 'happy';
    });
  }, [writePackId, isEdit]);

  useEffect(() => {
    preloadMoodPackIcons(writePackId);
  }, [writePackId]);

  useEffect(() => {
    preloadCharacterHairIcons();
  }, []);

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
    let cancelled = false;
    let attempts = 0;

    const applyCanvas = (
      state: DiaryCanvasState | null | undefined,
      src: string | null | undefined,
    ) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        if (attempts++ < 90) {
          window.requestAnimationFrame(() => applyCanvas(state, src));
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
        void canvas.loadCanvasState(state, src ?? undefined).catch(() => {
          if (!cancelled && src) void canvas.loadEditableImage(src);
        });
        drawingTouchedRef.current = true;
        return;
      }
      if (src) {
        void canvas.loadEditableImage(src).catch(() => {
          if (!cancelled) void canvas.loadImage(src);
        });
        drawingTouchedRef.current = true;
      }
    };

    void (async () => {
      if (resumeDraft?.hasDrawing) {
        const media = await loadWriteDraftMedia();
        if (cancelled) return;
        if (media.canvasState || media.imageUrl) {
          applyCanvas(media.canvasState, media.imageUrl);
          return;
        }
      }
      applyCanvas(initialEntry?.canvasState, initialEntry?.imageUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialEntry?.imageUrl, initialEntry?.canvasState, resumeDraft?.hasDrawing]);

  const flushWriteDraft = useCallback(async () => {
    const hasDrawing = Boolean(canvasRef.current?.hasContent());
    const meta = {
      date,
      title,
      content,
      mood,
      fontId,
      fontSize: fontSizeId,
      editingId: initialEntry?.id ?? null,
      hasDrawing,
    };
    if (!writeDraftHasContent(meta) && !hasDrawing) {
      // 아직 빈 새 글이면 굳이 저장하지 않음 (수정 모드는 원본이 있으므로 필드 바뀌면 저장)
      if (!isEdit) return;
    }
    saveWriteDraft(meta);
    try {
      await canvasRef.current?.prepareExport();
      const rawState = canvasRef.current?.getCanvasState() ?? null;
      const imageUrl = canvasRef.current?.toDataURL() ?? null;
      await saveWriteDraftMedia({
        canvasState: rawState,
        imageUrl: imageUrl || null,
      });
      if (hasDrawing) {
        saveWriteDraft({ ...meta, hasDrawing: true });
      }
    } catch (err) {
      console.warn('[draft] canvas flush failed', err);
    }
  }, [
    date,
    title,
    content,
    mood,
    fontId,
    fontSizeId,
    initialEntry?.id,
    isEdit,
  ]);

  // 텍스트·설정 자동 임시저장
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void flushWriteDraft();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [flushWriteDraft]);

  // 배포 새로고침·백그라운드 전환 직전 flush
  useEffect(() => {
    const onFlush = () => {
      void flushWriteDraft();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') onFlush();
    };
    window.addEventListener(DRAFT_FLUSH_EVENT, onFlush);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onFlush);
    return () => {
      window.removeEventListener(DRAFT_FLUSH_EVENT, onFlush);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onFlush);
    };
  }, [flushWriteDraft]);

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
    clearWriteDraft();
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
        clearPurchaseShield();
      }
    });
  }, [clearPurchaseShield]);

  // 네이티브 결제창에서 막 돌아온 뒤에만 팝업·유령 터치 정리
  // (일반 백그라운드 복귀에서 AI 로딩을 끄거나 로띠를 숨기지 않음)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() > proPurchaseGuardUntilRef.current) return;
      armPurchaseShield(6_000);
      setRewardPromptOpen(false);
      setAiDailyLimitOpen(false);
      setAdIncompleteOpen(false);
      setAiConfirmOpen(false);
      // 월한도 추가구매 모달은 유지 (실드가 모달 클릭을 막지 않도록 AppModal z-index > shield)
      setAiError(null);
      contentRef.current?.blur();
      titleRef.current?.blur();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [armPurchaseShield]);

  // AI 그리는 중 앱 복귀 시 로띠 다시 재생
  useEffect(() => {
    if (!aiLoading) return;
    let wasHidden = document.visibilityState === 'hidden';
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden) {
        wasHidden = true;
        return;
      }
      if (!wasHidden) return;
      wasHidden = false;
      window.setTimeout(() => {
        setAiLottieKey((key) => key + 1);
        setActiveAiLottie((prev) => prev ?? pickRandomLottie(aiLottiePool));
      }, 80);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
    };
  }, [aiLoading, aiLottiePool]);

  const saveAndLeave = () => {
    formRef.current?.requestSubmit();
  };

  const aiQuota = (() => {
    void accessTick;
    if (canUseProAiQuota()) {
      const status = getDiaryAccessState();
      const pack = getAiPackCredits();
      // 월한도 + 추가구매 잔량 (0이어도 버튼은 눌러 구매 모달 가능)
      const remaining = Math.max(0, status.monthlyRemaining) + pack;
      return {
        used: Math.max(0, status.monthlyLimit + pack - remaining),
        limit: status.monthlyLimit + pack,
      };
    }
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
    if (getAiPackCredits() > 0) {
      void runAiDraw();
      return;
    }
    if (isAiDailyLimitReached()) {
      onAppToast?.(t('write.err.aiAdDailyOnce'), 3000);
      setAiDailyLimitOpen(true);
      return;
    }
    if (AI_REWARD_AD_ENABLED) {
      setRewardPromptOpen(true);
      return;
    }
    setAiError(t('write.err.aiDailyLimit'));
  };

  /** Pro 월 50회 소진 후: 팩 잔량 있으면 바로 진행, 없으면 구매/광고 모달 */
  const promptProMonthlyExhausted = () => {
    if (getAiPackCredits() > 0) {
      void runAiDraw();
      return;
    }
    // 광고 1회를 이미 써도 10/20 추가구매 모달은 항상 열림
    proPurchaseGuardUntilRef.current = 0;
    setPurchaseClickShield(false);
    setProAiLimitOpen(true);
  };

  /** 월한도 소진 후 예약: 추가구매 팩 → 광고 일일 슬롯 (아직 차감 안 함) */
  const reserveProOverflowQuota = async (): Promise<boolean> => {
    if (await reserveAiPack()) {
      aiQuotaKindRef.current = 'ai-pack';
      return true;
    }
    if (getAiDrawCredits() > 0) {
      aiQuotaKindRef.current = 'free';
      return true;
    }
    return false;
  };

  const reserveAiPack = async (): Promise<boolean> => {
    const token = getAccessToken();
    if (token) {
      try {
        const view = await fetchAiPackCredits(token);
        applyAiPackCreditsFromServer(view.credits);
        return view.credits > 0;
      } catch {
        return getAiPackCredits() > 0;
      }
    }
    return getAiPackCredits() > 0;
  };

  const tryConsumeAiPack = async (): Promise<boolean> => {
    const token = getAccessToken();
    if (token) {
      try {
        const view = await consumeAiPackCreditsRemote(token);
        applyAiPackCreditsFromServer(view.credits);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('409')) return false;
        return consumeAiPackCredit();
      }
    }
    return consumeAiPackCredit();
  };

  /** 생성 전: 사용 가능 여부만 확인하고 차감 종류를 예약 (차감은 성공 후) */
  const reserveAiDrawQuota = async (): Promise<boolean> => {
    if (!isFlutterApp()) {
      aiQuotaKindRef.current = 'none';
      return true;
    }

    if (canUseProAiQuota() && !isProAiMonthlyLimitReached()) {
      const token = getAccessToken();
      if (token) {
        try {
          const usage = await fetchMonthlyUsage(token);
          applyMonthlyUsageFromServer(usage.used, usage.yearMonth);
          if (usage.allowed !== false && usage.used < usage.limit) {
            aiQuotaKindRef.current = 'pro-server';
            return true;
          }
          if (!(await reserveProOverflowQuota())) {
            promptProMonthlyExhausted();
            return false;
          }
          return true;
        } catch {
          // 로컬 잔여로 폴백
        }
      }
      if (getDiaryAccessState().monthlyRemaining > 0) {
        aiQuotaKindRef.current = 'pro-local';
        return true;
      }
      if (!(await reserveProOverflowQuota())) {
        promptProMonthlyExhausted();
        return false;
      }
      return true;
    }

    if (canUseProAiQuota() && isProAiMonthlyLimitReached()) {
      if (!(await reserveProOverflowQuota())) {
        promptProMonthlyExhausted();
        return false;
      }
      return true;
    }

    if (await reserveAiPack()) {
      aiQuotaKindRef.current = 'ai-pack';
      return true;
    }
    if (getAiDrawCredits() > 0) {
      aiQuotaKindRef.current = 'free';
      return true;
    }
    promptAiDrawBlocked();
    return false;
  };

  /** 그림 생성 성공 후에만 횟수 차감 */
  const commitAiDrawQuota = async (): Promise<void> => {
    const kind = aiQuotaKindRef.current;
    aiQuotaKindRef.current = 'none';
    if (kind === 'none') return;

    if (kind === 'pro-server') {
      const token = getAccessToken();
      if (token) {
        try {
          const usage = await consumeMonthlyUsage(token);
          applyMonthlyUsageFromServer(usage.used, usage.yearMonth);
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('409')) {
            if (await tryConsumeAiPack()) return;
            if (consumeAiDrawDailyQuota()) return;
            console.warn('[ai] commit monthly failed (409), image kept');
            return;
          }
          if (consumeProAiDrawQuota()) return;
          if (await tryConsumeAiPack()) return;
          consumeAiDrawDailyQuota();
          return;
        }
      }
      if (!consumeProAiDrawQuota()) {
        if (!(await tryConsumeAiPack())) consumeAiDrawDailyQuota();
      }
      return;
    }

    if (kind === 'pro-local') {
      if (!consumeProAiDrawQuota()) {
        if (!(await tryConsumeAiPack())) consumeAiDrawDailyQuota();
      }
      return;
    }

    if (kind === 'ai-pack') {
      if (!(await tryConsumeAiPack())) {
        console.warn('[ai] commit pack failed, image kept');
      }
      return;
    }

    if (kind === 'free') {
      if (!consumeAiDrawDailyQuota()) {
        console.warn('[ai] commit free slot failed, image kept');
      }
    }
  };

  const handleAiDraw = () => {
    clearPurchaseShield();
    if (!content.trim()) {
      setAiError(t('write.err.aiNeedContent'));
      return;
    }
    setAiStyleOpen(true);
  };

  const proceedAfterStylePick = (styleId: AiDrawStyleId) => {
    aiStyleRef.current = styleId;
    setAiStyleOpen(false);

    // 웹: 광고·일일/월간 한도 없이 바로 생성
    if (!isFlutterApp()) {
      void runAiDraw();
      return;
    }
    if (canUseProAiQuota()) {
      if (isProAiMonthlyLimitReached()) {
        promptProMonthlyExhausted();
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
    setAiError(null);
    if (!(await reserveAiDrawQuota())) return;

    setAiProgress('waiting');
    setActiveAiLottie(pickRandomLottie(aiLottiePool));
    setAiLottieKey((key) => key + 1);
    setAiLoading(true);

    try {
      const { preview: previousSnapshot, canvasState: previousState } =
        await capturePreviousSnapshot();
      previousCanvasStateRef.current = previousState;

      const { imageUrl, notice, imageSource } = await generateDiaryImage({
        title,
        content,
        character,
        style: aiStyleRef.current,
        accessToken: getAccessToken(),
        onProgress: setAiProgress,
      });

      await commitAiDrawQuota();
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
      if (notice) {
        setUsageNoticeKind(imageSource === 'runware-cdn' ? 'cdn' : 'refund');
        setUsageNotice(notice);
        setUsageNoticeOpen(true);
      }
    } catch {
      aiQuotaKindRef.current = 'none';
      showAiRetryToast();
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
    } catch {
      showAiRetryToast();
    }
  };

  const handleWatchAd = async () => {
    if (!isFlutterApp()) {
      setAiError(t('write.err.adAppOnly'));
      return;
    }
    if (isAiDailyLimitReached()) {
      setRewardPromptOpen(false);
      setProAiLimitOpen(false);
      onAppToast?.(t('write.err.aiAdDailyOnce'), 3000);
      if (canUseProAiQuota()) return;
      setAiDailyLimitOpen(true);
      return;
    }
    setRewardPromptOpen(false);
    setProAiLimitOpen(false);
    setAdIncompleteOpen(false);
    setAiError(null);
    clearPurchaseShield();
    const ok = await requestAiRewardedAd();
    if (!ok) {
      clearPurchaseShield();
      setAdIncompleteOpen(true);
      return;
    }
    // 광고 닫힌 직후 WebView가 바로 요청하면 실패하는 경우 대비
    clearPurchaseShield();
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 350);
    });
    if (!grantAiDrawCreditWithDailyCap(1)) {
      onAppToast?.(t('write.err.aiAdDailyOnce'), 3000);
      if (canUseProAiQuota()) return;
      setAiDailyLimitOpen(true);
      return;
    }
    await runAiDraw();
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
                durationHintSeconds={
                  aiStyleRef.current === 'oilPastel' ? 30 : 20
                }
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
                        {GENDER_EMOJI[character.gender]}
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
                    {isFlutterApp() && (
                      <span className="diary-write__ai-remaining">
                        {aiLeft}
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
            <div
              className="diary-write__purchase-shield"
              aria-hidden="true"
              onPointerUp={clearPurchaseShield}
              onClick={clearPurchaseShield}
            />
          )}
          {leaveConfirmOpen && (
            <AppModal
              title={t('write.confirm.saveOnLeave')}
              onDismiss={() => setLeaveConfirmOpen(false)}
              showClose
              closeAriaLabel={t('common.close')}
              secondaryLabel={t('write.confirm.saveOnLeaveDiscard')}
              onSecondary={leaveWithoutSaving}
              primaryLabel={isEdit ? t('write.saveEdit') : t('write.save')}
              onPrimary={saveAndLeave}
            />
          )}
          {aiStyleOpen && (
            <AppModal
              title={t('write.ai.styleTitle')}
              onDismiss={() => setAiStyleOpen(false)}
              showClose
              closeAriaLabel={t('common.close')}
            >
              <div className="diary-write__ai-styles" role="list">
                {AI_DRAW_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className="diary-write__ai-style-btn"
                    role="listitem"
                    onClick={() => proceedAfterStylePick(style.id)}
                  >
                    <span className="diary-write__ai-style-name">
                      {t(`write.ai.style.${style.id}.name`)}
                    </span>
                    <span className="diary-write__ai-style-desc">
                      {t(`write.ai.style.${style.id}.desc`)}
                    </span>
                  </button>
                ))}
              </div>
            </AppModal>
          )}
          {aiConfirmOpen && (
            <AppModal
              title={t('quota.drawConfirmTitle')}
              lead={String(aiLeft)}
              onDismiss={() => setAiConfirmOpen(false)}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('quota.drawConfirmOk')}
              onPrimary={() => {
                setAiConfirmOpen(false);
                void runAiDraw();
              }}
            />
          )}
          {usageNoticeOpen && (
            <AppModal
              title={
                usageNoticeKind === 'cdn'
                  ? t('write.ai.cdnFallbackTitle')
                  : t('write.ai.usageNotDeductedTitle')
              }
              lead={
                usageNotice ||
                (usageNoticeKind === 'cdn'
                  ? t('write.ai.cdnFallbackNotice')
                  : t('write.ai.usageNotDeducted'))
              }
              onDismiss={() => setUsageNoticeOpen(false)}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('common.ok')}
              onPrimary={() => setUsageNoticeOpen(false)}
            />
          )}
          {rewardPromptOpen && (
            <AppModal
              title={t('write.ai.rewardTitle')}
              lead={t('write.ai.rewardLeadDaily')}
              onDismiss={() => {
                clearPurchaseShield();
                setRewardPromptOpen(false);
              }}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('write.ai.rewardCta')}
              onPrimary={() => void handleWatchAd()}
            />
          )}
          {aiDailyLimitOpen && (
            <AppModal
              title={t('write.ai.chargeTitle')}
              onDismiss={() => {
                clearPurchaseShield();
                setAiDailyLimitOpen(false);
              }}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('write.ai.goPurchase')}
              onPrimary={() => {
                clearPurchaseShield();
                setAiDailyLimitOpen(false);
                openNyangTicket();
              }}
            />
          )}
          {proAiLimitOpen && (
            <AppModal
              title={t('write.ai.monthlyLimitTitle')}
              lead={t('write.ai.monthlyLimitLead')}
              onDismiss={() => setProAiLimitOpen(false)}
              showClose
              closeAriaLabel={t('common.close')}
            >
              <div className="app-modal__actions diary-write__ai-pack-actions">
                <button
                  type="button"
                  className="app-modal__btn app-modal__btn--primary"
                  onClick={() => {
                    setProAiLimitOpen(false);
                    openNyangTicket('packs');
                  }}
                >
                  {t('write.ai.buyExtraTicket')}
                </button>
                {AI_REWARD_AD_ENABLED ? (
                  <button
                    type="button"
                    className="app-modal__btn"
                    onClick={() => void handleWatchAd()}
                  >
                    {t('write.ai.adOneFree')}
                  </button>
                ) : null}
              </div>
            </AppModal>
          )}
          {adIncompleteOpen && (
            <AppModal
              title={t('write.ai.adIncompleteTitle')}
              lead={t('write.err.adNotCompleted')}
              onDismiss={() => setAdIncompleteOpen(false)}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('write.ai.rewardCta')}
              onPrimary={() => void handleWatchAd()}
            />
          )}
          {aiPickOpen && aiPickOptions.length > 0 && (
            <AppModal
              title={t('write.ai.pickTitle')}
              lead={t('write.ai.pickLead')}
              onDismiss={dismissAiPick}
              showClose
              closeAriaLabel={t('common.close')}
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
              showClose
              closeAriaLabel={t('common.close')}
            />
          )}
        </>,
        document.getElementById('root') ?? document.body,
      )}
    </form>
  );
}

export default DiaryWritePage;
