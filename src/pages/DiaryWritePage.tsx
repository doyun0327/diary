import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, FormEvent } from 'react';
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
import AiLoadingWait from '../components/AiLoadingWait';
import FortuneCookie from '../components/FortuneCookie';
import CalendarPopup from '../components/CalendarPopup';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingCanvasHandle } from '../components/DrawingCanvas';
import MoodIcon from '../components/MoodIcon';
import { extractSceneLine, generateDiaryImage, type AiProgress } from '../api/aiImage';
import AppModal from '../components/AppModal';
import CoachBubble from '../components/CoachBubble';
import { formatDate, today } from '../utils/date';
import {
  AI_DRAW_STYLES,
  aiStylePreviewSrc,
  fileToAiReferenceDataUrl,
  isAiDrawStyleEnabled,
  isAiPhotoTooLargeError,
  isAiPhotoTooLargeMessage,
  preloadAiStylePreviews,
  subscribeAiStylePreviewsReady,
  TEXT_OIL_STYLE_ID,
  type AiDrawStyleId,
} from '../utils/aiDrawStyles';
import { diaryEditFontStack, defaultFontIdForLanguage, ensureDiaryFontReady, findFont, fontSizeCss, getPreferredFontId, getPreferredFontSizeId, parseFontSizeId, DEFAULT_FONT_SIZE_ID } from '../utils/fonts';
import {
  AI_REWARD_AD_ENABLED,
  applyAiPackCreditsFromServer,
  applyMonthlyUsageFromServer,
  canUseInstallFreeAiDraw,
  canUseProAiQuota,
  consumeAiDrawDailyQuota,
  consumeAiPackCredit,
  consumeInstallFreeAiDraw,
  consumeProAiDrawQuota,
  FREE_DAILY_AI_AD_LIMIT,
  getAiDrawCredits,
  getAiDrawsToday,
  getAiPackCredits,
  getDiaryAccessState,
  getPurchasedAiPackCredits,
  getWelcomeAiCreditsRemaining,
  grantAiDrawCreditWithDailyCap,
  isAiDailyLimitReached,
  isProAiMonthlyLimitReached,
  needsAiAdBeforeDraw,
  noteAiPackCreditConsumedPreferWelcome,
  subscribeDiaryAccess,
} from '../utils/diaryAccess';
import {
  shouldShowAiDeductCoach,
  markAiDeductCoachShown,
  shouldShowAiClickCoach,
  markAiCoachSeen,
  getAiSourceTutorialProgress,
  markAiSourceDiaryTutorialSeen,
  markAiSourceIntroSeen,
  type AiSourceTutorialProgress,
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
import { getAccessToken, isGoogleSignedIn, useAuthSession } from '../hooks/useAuthSession';
import {
  readStoredAgeGroup,
  readStoredGender,
} from '../hooks/useClientProfile';
import { profileLookForAi } from '../utils/profileDemographics';
import { mountGoogleSignInButton } from '../lib/googleAuth';
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

/** 본문 높이 = 글 줄 수 (+ 입력 중일 때만 빈 줄 1줄), 최소 3줄 */
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
  const minHeight = lh * 3;
  el.style.height = `${Math.max(contentHeight + extra, minHeight)}px`;
}
interface DiaryWritePageProps {
  /** 있으면 수정 모드 */
  initialEntry?: DiaryEntry;
  /** 새 글일 때 기본 날짜 (메인 달력 선택일) */
  initialDate?: string;
  onSave: (
    entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'> & {
      clearDrawing?: boolean;
    },
  ) => void | Promise<void>;
  onCancel: () => void;
  /** Flutter AppBar 저장 버튼 활성 상태 */
  onNativeSaveStateChange?: (enabled: boolean, saving?: boolean) => void;
  writeQuota?: { used: number; limit: number };
  /** 저장 토스트와 동일한 app-toast (durationMs 기본 1.8초) */
  onAppToast?: (message: string, durationMs?: number) => void;
}

function DiaryWritePage({
  initialEntry,
  initialDate,
  onSave,
  onCancel,
  onNativeSaveStateChange,
  writeQuota: _writeQuota,
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
    () => resumeDraft?.date ?? initialEntry?.date ?? initialDate ?? today(),
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
    () =>
      resumeDraft?.fontId ??
      initialEntry?.fontId ??
      (initialEntry ? defaultFontIdForLanguage() : getPreferredFontId()),
  );
  const [fontSizeId, setFontSizeId] = useState(
    () =>
      parseFontSizeId(
        resumeDraft?.fontSize ??
          initialEntry?.fontSize ??
          (initialEntry ? DEFAULT_FONT_SIZE_ID : getPreferredFontSizeId()),
      ),
  );
  const [canvasCollapsed, setCanvasCollapsed] = useState(false);
  /** 수정 진입 시 기존 그림 하이드레이션 중 */
  const [drawingLoading, setDrawingLoading] = useState(() =>
    Boolean(
      initialEntry?.imageUrl ||
        initialEntry?.canvasState ||
        resumeDraft?.hasDrawing,
    ),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState<AiProgress>('waiting');
  const [fortuneVisible, setFortuneVisible] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLottiePool, setAiLottiePool] = useState<object[]>([]);
  const [activeAiLottie, setActiveAiLottie] = useState<object | null>(null);
  const [aiLottieKey, setAiLottieKey] = useState(0);
  const [rewardPromptOpen, setRewardPromptOpen] = useState(false);
  const [aiDailyLimitOpen, setAiDailyLimitOpen] = useState(false);
  const [proAiLimitOpen, setProAiLimitOpen] = useState(false);
  const [adIncompleteOpen, setAdIncompleteOpen] = useState(false);
  const [aiStyleOpen, setAiStyleOpen] = useState(false);
  /** 그림 생성: 일기(textOil) vs 사진 */
  const [aiSourceOpen, setAiSourceOpen] = useState(false);
  /** 튜토리얼 중 예시 패널: diary | photo */
  const [aiSourceTutPanel, setAiSourceTutPanel] = useState<
    'diary' | 'photo' | null
  >(null);
  const [aiSourceTutProgress, setAiSourceTutProgress] =
    useState<AiSourceTutorialProgress>(() => getAiSourceTutorialProgress());
  /** 모달에서 고른 스타일 (확인 전까지 대기) */
  const [aiStyleSelectedId, setAiStyleSelectedId] =
    useState<AiDrawStyleId>('webtoonHero');
  /** AI 그림용 참조 사진 (data URL) */
  const [aiReferenceImage, setAiReferenceImage] = useState<string | null>(null);
  const [aiPhotoError, setAiPhotoError] = useState<string | null>(null);
  const aiPhotoInputRef = useRef<HTMLInputElement>(null);
  const [aiLoginOpen, setAiLoginOpen] = useState(false);
  const [aiLoginBusy, setAiLoginBusy] = useState(false);
  const [aiLoginError, setAiLoginError] = useState<string | null>(null);
  const [aiQuotaDetailOpen, setAiQuotaDetailOpen] = useState(false);
  const aiRemainingBtnRef = useRef<HTMLButtonElement>(null);
  const aiQuotaPopRef = useRef<HTMLDivElement>(null);
  const [aiQuotaPopPos, setAiQuotaPopPos] = useState<{
    top: number;
    left: number;
    arrowLeft: number;
    place: 'above' | 'below';
  } | null>(null);
  const googleBtnHostRef = useRef<HTMLDivElement>(null);
  const { signInWithGoogleIdToken } = useAuthSession();
  const [usageNoticeOpen, setUsageNoticeOpen] = useState(false);
  const [usageNotice, setUsageNotice] = useState('');
  const [usageNoticeKind, setUsageNoticeKind] = useState<'refund' | 'cdn'>('refund');
  const aiStyleRef = useRef<AiDrawStyleId>('webtoonHero');
  /** diary = textOil(일기), photo = 사진+스타일3 */
  const aiSourceRef = useRef<'diary' | 'photo'>('photo');
  const aiReferenceImageRef = useRef<string | null>(null);
  const aiQuotaKindRef = useRef<
    'none' | 'pro-server' | 'pro-local' | 'free' | 'install-free' | 'ai-pack'
  >('none');
  const [aiPickOpen, setAiPickOpen] = useState(false);
  const [aiGeneratedImages, setAiGeneratedImages] = useState<string[]>([]);
  const [aiPickOptions, setAiPickOptions] = useState<AiPickOption[]>([]);
  const [aiPickSelected, setAiPickSelected] = useState<Set<number>>(() => new Set());
  const [accessTick, setAccessTick] = useState(0);
  const [aiPreviewTick, setAiPreviewTick] = useState(0);
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
  const drawingClearedRef = useRef(false);
  const baselineRef = useRef({
    date: resumeDraft?.date ?? initialEntry?.date ?? initialDate ?? today(),
    title: resumeDraft?.title ?? initialEntry?.title ?? '',
    content: resumeDraft?.content ?? initialEntry?.content ?? '',
    mood: (resumeDraft?.mood ??
      initialEntry?.mood ??
      defaultStickerForPack(getStoredMoodPackId())) as DiarySticker,
    fontId:
      resumeDraft?.fontId ??
      initialEntry?.fontId ??
      (initialEntry ? defaultFontIdForLanguage() : getPreferredFontId()),
    fontSizeId: parseFontSizeId(
      resumeDraft?.fontSize ??
        initialEntry?.fontSize ??
        (initialEntry ? DEFAULT_FONT_SIZE_ID : getPreferredFontSizeId()),
    ),
    hadImage:
      Boolean(initialEntry?.imageUrl) || Boolean(resumeDraft?.hasDrawing),
  });
  const [coach, setCoach] = useState<'click' | 'ai' | null>(() => {
    if (isEdit) return null;
    if (shouldShowAiClickCoach()) return 'click';
    if (shouldShowAiDeductCoach()) return 'ai';
    return null;
  });
  /** 이 작성 화면에서 차감 코치를 이미 띄웠는지 (accessTick으로 반복 노출 방지) */
  const aiDeductCoachShownThisVisitRef = useRef(coach === 'ai');
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
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

  useEffect(() => subscribeAiStylePreviewsReady(() => setAiPreviewTick((n) => n + 1)), []);

  useEffect(() => {
    drawingClearedRef.current = false;
  }, [initialEntry?.id]);

  // 엔트리 id가 바뀔 때만 원본 스냅샷 갱신 — 저장 직후 props(imageUrl/canvas) 변경으로
  // AI 선택지·캔버스가 리셋되면 수정 내용이 사라진 것처럼 깜박임
  useEffect(() => {
    editOriginalImageRef.current = initialEntry?.imageUrl ?? null;
    previousCanvasStateRef.current = cloneCanvasState(initialEntry?.canvasState);
    setAiGeneratedImages([]);
    setAiPickOptions([]);
    setAiPickSelected(new Set());
    setAiPickOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / 다른 일기 편집 시에만
  }, [initialEntry?.id]);

  useEffect(() => {
    if (isEdit) return;
    if (resumeDraft?.fontId) return;
    setFontId(getPreferredFontId());
  }, [i18n.language, isEdit, resumeDraft?.fontId]);

  useEffect(() => {
    void ensureDiaryFontReady(fontId);
  }, [fontId]);

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
    if (composingRef.current) return;
    syncContentTextareaHeight(contentRef.current);
  }, [content, fontId, fontSizeId]);

  useEffect(() => {
    if (isEdit) {
      setCoach(null);
      return;
    }
    // 첫 방문: 그림생성 클릭 유도가 우선
    if (shouldShowAiClickCoach()) {
      setCoach('click');
      return;
    }
    if (!shouldShowAiDeductCoach()) {
      setCoach((prev) => (prev === 'click' ? null : prev === 'ai' ? null : prev));
      return;
    }
    if (aiDeductCoachShownThisVisitRef.current) return;
    aiDeductCoachShownThisVisitRef.current = true;
    setCoach('ai');
  }, [isEdit, accessTick]);

  const dismissAiCoach = () => {
    setCoach((prev) => {
      if (prev === 'click') {
        markAiCoachSeen();
        return null;
      }
      if (prev === 'ai') {
        markAiDeductCoachShown();
        return null;
      }
      return prev;
    });
  };

  // 차감 안내만 자동 닫힘 — 클릭해보세요는 누를 때까지 유지
  useEffect(() => {
    if (coach !== 'ai') return;
    const timer = window.setTimeout(() => {
      dismissAiCoach();
    }, 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 표시될 때만 타이머
  }, [coach]);

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

  // 초기 1회만 캔버스 하이드레이션. 저장 시 entries 갱신·초안 삭제로
  // imageUrl/canvasState/hasDrawing이 바뀌며 재로드되면 그림이 사라졌다가 다시 그려짐
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const entryCanvas = initialEntry?.canvasState;
    const entryImage = initialEntry?.imageUrl;
    const draftHasDrawing = resumeDraft?.hasDrawing;
    const needsLoad = Boolean(
      entryImage ||
        entryCanvas ||
        draftHasDrawing,
    );
    setDrawingLoading(needsLoad);
    if (!needsLoad) return;

    const applyCanvas = async (
      state: DiaryCanvasState | null | undefined,
      src: string | null | undefined,
    ) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        if (attempts++ < 90) {
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve());
          });
          if (!cancelled) await applyCanvas(state, src);
        }
        return;
      }
      const hasLayers = Boolean(
        state &&
          ((state.photos?.length ?? 0) > 0 ||
            (state.stickers?.length ?? 0) > 0 ||
            state.inkUrl),
      );
      try {
        if (hasLayers && state) {
          try {
            await canvas.loadCanvasState(state, src ?? undefined);
          } catch {
            if (!cancelled && src) await canvas.loadEditableImage(src);
          }
          drawingTouchedRef.current = true;
          return;
        }
        if (src) {
          try {
            await canvas.loadEditableImage(src);
          } catch {
            if (!cancelled) await canvas.loadImage(src);
          }
          drawingTouchedRef.current = true;
        }
      } finally {
        // keep going
      }
    };

    void (async () => {
      try {
        if (draftHasDrawing) {
          const media = await loadWriteDraftMedia();
          if (cancelled) return;
          if (media.canvasState || media.imageUrl) {
            await applyCanvas(media.canvasState, media.imageUrl);
            return;
          }
        }
        await applyCanvas(entryCanvas, entryImage);
      } finally {
        if (!cancelled) setDrawingLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entryId 변경(또는 새 글 마운트) 시에만
  }, [initialEntry?.id]);

  const flushWriteDraftMeta = useCallback(() => {
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

  const flushWriteDraftMedia = useCallback(async () => {
    try {
      await canvasRef.current?.prepareExport();
      const rawState = canvasRef.current?.getCanvasState() ?? null;
      const imageUrl = canvasRef.current?.toDataURL() ?? null;
      const hasDrawing = Boolean(canvasRef.current?.hasContent());
      await saveWriteDraftMedia({
        canvasState: rawState,
        imageUrl: imageUrl || null,
      });
      if (hasDrawing) {
        saveWriteDraft({
          date,
          title,
          content,
          mood,
          fontId,
          fontSize: fontSizeId,
          editingId: initialEntry?.id ?? null,
          hasDrawing: true,
        });
      }
    } catch (err) {
      console.warn('[draft] canvas flush failed', err);
    }
  }, [date, title, content, mood, fontId, fontSizeId, initialEntry?.id]);

  const flushWriteDraft = useCallback(async () => {
    flushWriteDraftMeta();
    await flushWriteDraftMedia();
  }, [flushWriteDraftMeta, flushWriteDraftMedia]);

  // 텍스트·설정만 가볍게 자동 임시저장 (캔버스 export는 타이핑마다 하지 않음)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      flushWriteDraftMeta();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [flushWriteDraftMeta]);

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

  // 그리기 단계 진입 후 로띠 → 포춘쿠키로 교체 (완료·이미지 선택 시 자동 숨김)
  useEffect(() => {
    if (!aiLoading || aiProgress === 'waiting') return;
    if (fortuneVisible) return;
    const timer = window.setTimeout(() => setFortuneVisible(true), 2800);
    return () => window.clearTimeout(timer);
  }, [aiLoading, aiProgress, fortuneVisible]);

  const saveAndLeave = () => {
    formRef.current?.requestSubmit();
  };

  const aiQuota = (() => {
    void accessTick;
    const pack = getAiPackCredits();
    if (canUseProAiQuota()) {
      const status = getDiaryAccessState();
      // 월한도 + 추가구매·환영 팩 잔량
      const remaining = Math.max(0, status.monthlyRemaining) + pack;
      return {
        used: Math.max(0, status.monthlyLimit + pack - remaining),
        limit: status.monthlyLimit + pack,
      };
    }
    // 무료: 팩 → 설치 무료 1회 → 광고 일일 1
    if (pack > 0) {
      return { used: 0, limit: pack };
    }
    if (canUseInstallFreeAiDraw()) {
      return { used: 0, limit: 1 };
    }
    const adCredits = getAiDrawCredits();
    if (adCredits > 0) {
      return { used: 0, limit: adCredits };
    }
    return {
      used: getAiDrawsToday(),
      limit: FREE_DAILY_AI_AD_LIMIT,
    };
  })();
  const aiLeft = Math.max(0, aiQuota.limit - aiQuota.used);
  const aiQuotaBreakdown = (() => {
    void accessTick;
    const lines: { key: string; n: number; labelKey: string }[] = [];
    if (canUseProAiQuota()) {
      const sub = Math.max(0, getDiaryAccessState().monthlyRemaining);
      if (sub > 0) {
        lines.push({ key: 'sub', n: sub, labelKey: 'quota.breakdownSub' });
      }
    }
    const welcome = getWelcomeAiCreditsRemaining();
    if (welcome > 0) {
      lines.push({ key: 'welcome', n: welcome, labelKey: 'quota.breakdownWelcome' });
    }
    const purchased = getPurchasedAiPackCredits();
    if (purchased > 0) {
      lines.push({ key: 'pack', n: purchased, labelKey: 'quota.breakdownPack' });
    }
    if (canUseInstallFreeAiDraw() && !canUseProAiQuota()) {
      lines.push({ key: 'install-free', n: 1, labelKey: 'quota.breakdownInstallFree' });
    }
    const hasCreditLine = lines.some(
      (l) =>
        l.key === 'sub' ||
        l.key === 'welcome' ||
        l.key === 'pack' ||
        l.key === 'install-free',
    );
    if (!hasCreditLine) {
      const ad = getAiDrawCredits();
      if (ad > 0) {
        lines.push({ key: 'ad', n: ad, labelKey: 'quota.breakdownAd' });
      } else if (!canUseProAiQuota()) {
        lines.push({
          key: 'ad-daily',
          n: Math.max(0, FREE_DAILY_AI_AD_LIMIT - getAiDrawsToday()),
          labelKey: 'quota.breakdownAd',
        });
      }
    }
    return lines;
  })();

  useLayoutEffect(() => {
    if (!aiQuotaDetailOpen) {
      setAiQuotaPopPos(null);
      return;
    }
    const place = () => {
      const btn = aiRemainingBtnRef.current;
      const pop = aiQuotaPopRef.current;
      if (!btn || !pop) return;
      const pad = 16;
      const gap = 10;
      const br = btn.getBoundingClientRect();
      const pr = pop.getBoundingClientRect();
      let left = br.right - pr.width;
      left = Math.max(pad, Math.min(left, window.innerWidth - pad - pr.width));
      let top = br.top - gap - pr.height;
      let place: 'above' | 'below' = 'above';
      if (top < pad) {
        top = Math.min(br.bottom + gap, window.innerHeight - pad - pr.height);
        place = 'below';
      }
      const arrowLeft = Math.max(
        14,
        Math.min(pr.width - 14, br.left + br.width / 2 - left),
      );
      setAiQuotaPopPos({ top, left, arrowLeft, place });
    };
    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [aiQuotaDetailOpen, aiQuotaBreakdown.length, aiLeft]);

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
        noteAiPackCreditConsumedPreferWelcome();
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

    // Pro: 팩 잔량 먼저 → 그다음 구독 월 한도 → 광고
    if (canUseProAiQuota()) {
      if (await reserveAiPack()) {
        aiQuotaKindRef.current = 'ai-pack';
        return true;
      }
      if (!isProAiMonthlyLimitReached()) {
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
      }
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
    if (canUseInstallFreeAiDraw()) {
      aiQuotaKindRef.current = 'install-free';
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

    if (kind === 'install-free') {
      if (!consumeInstallFreeAiDraw()) {
        console.warn('[ai] commit install-free failed, image kept');
      }
      return;
    }

    if (kind === 'free') {
      if (!consumeAiDrawDailyQuota()) {
        console.warn('[ai] commit free slot failed, image kept');
      }
    }
  };

  const openAiSourcePicker = () => {
    setAiPhotoError(null);
    setAiSourceTutPanel(null);
    setAiSourceTutProgress(getAiSourceTutorialProgress());
    setAiSourceOpen(true);
  };

  const dismissAiSourcePicker = () => {
    // 예시 패널이 열려 있으면 먼저 닫고 다음 단계로
    if (aiSourceTutPanel === 'diary') {
      markAiSourceDiaryTutorialSeen();
      setAiSourceTutProgress('need-photo');
      setAiSourceTutPanel(null);
      return;
    }
    if (aiSourceTutPanel === 'photo') {
      markAiSourceIntroSeen();
      setAiSourceTutProgress('done');
      setAiSourceTutPanel(null);
      return;
    }
    setAiSourceOpen(false);
  };

  const handleAiDraw = () => {
    clearPurchaseShield();
    if (shouldShowAiClickCoach()) {
      markAiCoachSeen();
      setCoach((c) => (c === 'click' ? null : c));
    }
    // 웹: 로그인·한도 없이 방식 선택
    if (!isFlutterApp()) {
      openAiSourcePicker();
      return;
    }
    // 게스트·무료: 설치 무료·팩·광고슬롯 없으면 구독/광고 유도
    if (!canUseProAiQuota()) {
      if (
        getAiPackCredits() <= 0 &&
        getAiDrawCredits() <= 0 &&
        !canUseInstallFreeAiDraw() &&
        isAiDailyLimitReached()
      ) {
        setAiDailyLimitOpen(true);
        return;
      }
    }
    openAiSourcePicker();
  };

  const finishAiLoginAndDraw = useCallback(async () => {
    setAiLoginOpen(false);
    setAiLoginBusy(false);
    setAiLoginError(null);
    setAiPhotoError(null);
    setAiSourceOpen(true);
  }, []);

  /** 광고·한도 확인 후 생성 (방식·스타일 확정된 뒤) */
  const beginAiDrawAfterSetup = () => {
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
    if (canUseInstallFreeAiDraw() || getAiPackCredits() > 0 || getAiDrawCredits() > 0) {
      void runAiDraw();
      return;
    }
    if (isAiDailyLimitReached()) {
      promptAiDrawBlocked();
      return;
    }
    if (needsAiAdBeforeDraw()) {
      // 비회원: 자동 광고 재생 대신 광고 1회 + 구독하기
      setRewardPromptOpen(true);
      return;
    }
    void runAiDraw();
  };

  const proceedDiaryDraw = () => {
    // 튜토리얼: 첫 클릭은 예시만 보여 줌
    if (aiSourceTutProgress === 'need-diary') {
      setAiSourceTutPanel('diary');
      return;
    }
    const line = extractSceneLine(content) || title.trim();
    if (!line) {
      setAiError(t('write.err.needContent'));
      setAiSourceOpen(false);
      return;
    }
    aiSourceRef.current = 'diary';
    aiStyleRef.current = TEXT_OIL_STYLE_ID;
    setAiSourceOpen(false);
    beginAiDrawAfterSetup();
  };

  const openPhotoStylePicker = () => {
    if (aiSourceTutProgress === 'need-diary') return;
    if (aiSourceTutProgress === 'need-photo') {
      preloadAiStylePreviews();
      setAiSourceTutPanel('photo');
      return;
    }
    aiSourceRef.current = 'photo';
    setAiSourceOpen(false);
    setAiPhotoError(null);
    setAiStyleSelectedId(
      aiStyleRef.current === TEXT_OIL_STYLE_ID ? 'webtoonHero' : aiStyleRef.current,
    );
    setAiStyleOpen(true);
  };

  const proceedAfterStylePick = (styleId: AiDrawStyleId) => {
    if (!aiReferenceImageRef.current?.startsWith('data:image/')) {
      setAiPhotoError(t('write.err.aiNeedPhoto'));
      return;
    }
    if (!isAiDrawStyleEnabled(styleId) || styleId === TEXT_OIL_STYLE_ID) {
      setAiPhotoError(t('write.ai.styleDisabled'));
      return;
    }
    aiSourceRef.current = 'photo';
    aiStyleRef.current = styleId;
    setAiStyleOpen(false);
    beginAiDrawAfterSetup();
  };

  const handleAiGoogleIdToken = useCallback(
    (idToken: string) => {
      setAiLoginBusy(true);
      setAiLoginError(null);
      void (async () => {
        try {
          await signInWithGoogleIdToken(idToken);
          if (!isGoogleSignedIn()) {
            setAiLoginError(t('write.ai.loginFailed'));
            return;
          }
          await finishAiLoginAndDraw();
        } catch {
          setAiLoginError(t('write.ai.loginFailed'));
        } finally {
          setAiLoginBusy(false);
        }
      })();
    },
    [finishAiLoginAndDraw, signInWithGoogleIdToken, t],
  );

  useEffect(() => {
    if (!aiLoginOpen || isFlutterApp()) return;
    const host = googleBtnHostRef.current;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!host || !clientId) return;
    const ac = new AbortController();
    let dispose: (() => void) | undefined;
    void mountGoogleSignInButton(host, clientId, handleAiGoogleIdToken, ac.signal)
      .then((cleanup) => {
        if (ac.signal.aborted) {
          cleanup();
          return;
        }
        dispose = cleanup;
      })
      .catch(() => {
        setAiLoginError(t('write.ai.loginFailed'));
      });
    return () => {
      ac.abort();
      dispose?.();
    };
  }, [aiLoginOpen, handleAiGoogleIdToken, t]);

  const handleAiPhotoPick = async (file: File | undefined) => {
    if (!file) return;
    setAiPhotoError(null);
    try {
      const dataUrl = await fileToAiReferenceDataUrl(file);
      setAiReferenceImage(dataUrl);
      aiReferenceImageRef.current = dataUrl;
    } catch (err) {
      setAiReferenceImage(null);
      aiReferenceImageRef.current = null;
      setAiPhotoError(
        isAiPhotoTooLargeError(err)
          ? t('write.ai.photoTooLarge')
          : t('write.ai.photoError'),
      );
    }
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
    setFortuneVisible(false);
    setActiveAiLottie(pickRandomLottie(aiLottiePool));
    setAiLottieKey((key) => key + 1);
    setAiLoading(true);

    try {
      const { preview: previousSnapshot, canvasState: previousState } =
        await capturePreviousSnapshot();
      previousCanvasStateRef.current = previousState;

      const isDiary = aiSourceRef.current === 'diary'
        || aiStyleRef.current === TEXT_OIL_STYLE_ID;
      const ref = aiReferenceImageRef.current;
      if (!isDiary && !ref?.startsWith('data:image/')) {
        throw new Error(t('write.err.aiNeedPhoto'));
      }
      if (isDiary) {
        const line = extractSceneLine(content) || title.trim();
        if (!line) {
          throw new Error(t('write.err.needContent'));
        }
      }

      const { imageUrl, notice, imageSource } = await generateDiaryImage({
        title,
        content,
        style: isDiary ? TEXT_OIL_STYLE_ID : aiStyleRef.current,
        referenceImage: isDiary ? null : ref,
        character: isDiary
          ? profileLookForAi(readStoredGender(), readStoredAgeGroup())
          : null,
        accessToken: getAccessToken(),
        onProgress: setAiProgress,
      });

      const quotaKind = aiQuotaKindRef.current;
      await commitAiDrawQuota();
      if (quotaKind === 'free') {
        onAppToast?.(t('write.ai.freeDailyUsedToast'), 4000);
      }
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
    } catch (err) {
      aiQuotaKindRef.current = 'none';
      const msg = err instanceof Error ? err.message : '';
      if (isAiPhotoTooLargeError(err) || isAiPhotoTooLargeMessage(msg)) {
        setAiPhotoError(t('write.ai.photoTooLarge'));
        onAppToast?.(t('write.ai.photoTooLarge'));
      } else {
        showAiRetryToast();
      }
    } finally {
      setAiLoading(false);
      setFortuneVisible(false);
    }
  };

  const dismissAiPick = () => {
    setAiPickOpen(false);
    setAiPickOptions([]);
    setAiPickSelected(new Set());
  };

  const toggleAiPick = (index: number) => {
    setFortuneVisible(false);
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
    setAiError(null);
    setSaveError(null);
    try {
      let imageUrl: string | undefined;
      let canvasState: DiaryCanvasState | undefined;
      try {
        const captured = await canvasRef.current?.captureForSave();
        if (captured?.hasContent) {
          canvasState = await resolveCanvasStateForSave(
            captured.canvasState ?? null,
          );
          imageUrl = captured.imageUrl || undefined;
          if (!imageUrl && !canvasState) {
            setSaveError(t('write.err.saveImage'));
            return;
          }
        }
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : t('write.err.saveImage'),
        );
        return;
      }

      if (!title.trim() && !content.trim() && !imageUrl && !isEdit) {
        setAiError(t('write.err.empty'));
        return;
      }

      const payload: Parameters<typeof onSave>[0] = {
        date,
        title: title.trim(),
        content: content.trim(),
        mood,
        moodPack: writePackId,
        fontId,
        fontSize: fontSizeId,
      };
      if (imageUrl || canvasState) {
        payload.imageUrl = imageUrl;
        payload.canvasState = canvasState;
      } else if (isEdit && drawingClearedRef.current) {
        // 전체 지우기 후에만 기존 그림 삭제 (빈 캡처로 undefined 덮어쓰기 금지)
        payload.imageUrl = undefined;
        payload.canvasState = undefined;
        payload.clearDrawing = true;
      }
      // 수정 + 그림 없음 + 지우기 안 함 → 미디어 필드 생략 = 기존 유지
      await onSave(payload);
      // 저장 성공 후에만 초안 삭제 — 저장 중 삭제하면 캔버스 이펙트가 재실행되며 깜박임
      clearWriteDraft();
      drawingClearedRef.current = false;
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
    if (!composingRef.current) {
      syncContentTextareaHeight(e.target, { extraBlankLine: true });
    }
  };

  const handleContentCompositionStart = () => {
    composingRef.current = true;
  };

  const handleContentCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>,
  ) => {
    composingRef.current = false;
    syncContentTextareaHeight(e.currentTarget, { extraBlankLine: true });
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
          ['--diary-font' as string]: diaryEditFontStack(findFont(fontId).family),
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
            {drawingLoading ? (
              <div className="diary-write__canvas-loading" role="status" aria-live="polite">
                {t('write.drawingLoading')}
              </div>
            ) : null}
            <DrawingCanvas
              ref={canvasRef}
              fontId={fontId}
              onFontIdChange={setFontId}
              fontSizeId={fontSizeId}
              onFontSizeChange={setFontSizeId}
              onCleared={() => {
                drawingClearedRef.current = true;
              }}
            />
            {aiLoading && !purchaseClickShield && (
              <AiLoadingWait
                animationData={activeAiLottie}
                lottieKey={aiLottieKey}
                step={aiProgress}
                sourceText={content}
                hideStage={fortuneVisible}
              />
            )}
            {fortuneVisible && !purchaseClickShield && (
              <div
                className={`diary-write__fortune-layer${aiLoading ? ' is-loading' : ''}`}
              >
                <FortuneCookie onDismiss={() => setFortuneVisible(false)} />
              </div>
            )}
            </div>
          </div>
        </section>

        <section className="diary-write__section diary-write__section--grow">
          <div className="diary-write__section-head">
            <div className="diary-write__ai-block">
              <div className="diary-write__ai-actions">
                <div className="diary-write__ai-draw-row">
                  <div
                    className={[
                      'diary-write__ai-draw',
                      coach === 'click' ? 'diary-write__ai-draw--pulse' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="diary-write__coach-anchor diary-write__coach-anchor--ai">
                      <button
                        type="button"
                        className="diary-write__ai-link"
                        onClick={handleAiDraw}
                        disabled={aiLoading}
                      >
                        {aiLabel}
                      </button>
                      {(coach === 'click' || coach === 'ai') && (
                        <CoachBubble
                          className="diary-write__coach diary-write__coach--ai"
                          arrow="bottom-right"
                          onDismiss={dismissAiCoach}
                        >
                          <p>
                            {coach === 'click'
                              ? t('write.coach.click')
                              : t('write.coach.ai')}
                          </p>
                        </CoachBubble>
                      )}
                    </div>
                  </div>
                  {isFlutterApp() && (
                    <span className="diary-write__ai-remaining-wrap">
                      <button
                        ref={aiRemainingBtnRef}
                        type="button"
                        className={`diary-write__ai-remaining${aiQuotaDetailOpen ? ' is-open' : ''}`}
                        title={t('quota.deductAfterDone')}
                        aria-expanded={aiQuotaDetailOpen}
                        aria-label={t('quota.breakdownAria', { n: aiLeft })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAiQuotaDetailOpen((open) => !open);
                        }}
                      >
                        <span className="diary-write__ai-remaining-n">{aiLeft}</span>
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <textarea
            ref={contentRef}
            className="diary-write__content"
            value={content}
            onChange={handleContentChange}
            onCompositionStart={handleContentCompositionStart}
            onCompositionEnd={handleContentCompositionEnd}
            onFocus={handleContentFocus}
            placeholder={t('write.contentPlaceholder')}
          />
          {aiError && <p className="diary-write__ai-error">{aiError}</p>}
        </section>
      </div>
      {createPortal(
        <>
          {aiQuotaDetailOpen && (
            <>
              <button
                type="button"
                className="diary-write__ai-quota-scrim"
                aria-label={t('common.close')}
                onClick={() => setAiQuotaDetailOpen(false)}
              />
              <div
                ref={aiQuotaPopRef}
                className={`diary-write__ai-quota-pop${aiQuotaPopPos ? ' is-placed' : ''}${aiQuotaPopPos?.place === 'below' ? ' is-below' : ''}`}
                role="dialog"
                aria-label={t('quota.breakdownTitle')}
                style={
                  aiQuotaPopPos
                    ? ({
                        top: aiQuotaPopPos.top,
                        left: aiQuotaPopPos.left,
                        ['--quota-arrow-left' as string]: `${aiQuotaPopPos.arrowLeft}px`,
                      } as CSSProperties)
                    : undefined
                }
              >
                {aiQuotaBreakdown.length > 0 ? (
                  <ul className="diary-write__ai-quota-list">
                    {aiQuotaBreakdown.map((line) => (
                      <li key={line.key}>
                        {t(line.labelKey, { n: line.n })}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="diary-write__ai-quota-empty">
                    {t('quota.breakdownEmpty')}
                  </p>
                )}
              </div>
            </>
          )}
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
          {aiSourceOpen && (
            <AppModal
              title={
                aiSourceTutPanel === 'diary'
                  ? t('write.ai.sourceTutDiaryTitle')
                  : aiSourceTutPanel === 'photo'
                    ? t('write.ai.sourceTutPhotoTitle')
                    : t('write.ai.sourceTitle')
              }
              panelClassName="app-modal__panel--ai-source"
              onDismiss={dismissAiSourcePicker}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={aiSourceTutPanel ? t('common.ok') : undefined}
              onPrimary={aiSourceTutPanel ? dismissAiSourcePicker : undefined}
            >
              {aiSourceTutPanel === 'diary' ? (
                <div className="diary-write__ai-source-example">
                  <img
                    src="/preview/textoil.png"
                    alt=""
                    className="diary-write__ai-source-example-img"
                    decoding="async"
                  />
                  <p className="diary-write__ai-source-example-cap">
                    {t('write.ai.sourceTutDiaryBody')}
                  </p>
                  <p className="diary-write__ai-source-example-note">
                    {t('write.ai.sourceTutDiaryProfileNote')}
                  </p>
                  <p className="diary-write__ai-source-example-note diary-write__ai-source-example-note--sub">
                    {t('write.ai.sourceTutDiaryProfileChange')}
                  </p>
                </div>
              ) : null}
              {aiSourceTutPanel === 'photo' ? (
                <div className="diary-write__ai-source-example">
                  <div className="diary-write__ai-source-styles">
                    {AI_DRAW_STYLES.map((style) => {
                      void aiPreviewTick;
                      const path = style.previewSrcs[0] ?? '';
                      const coverSrc =
                        (path ? aiStylePreviewSrc(path) : '') || path;
                      return (
                        <div
                          key={style.id}
                          className="diary-write__ai-source-style"
                        >
                          <img
                            src={coverSrc}
                            alt=""
                            className="diary-write__ai-source-style-img"
                            decoding="async"
                          />
                          <span
                            className={[
                              'diary-write__ai-source-style-name',
                              style.id === 'jpRetroFilm'
                                ? ''
                                : 'diary-write__ai-source-style-name--center',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {t(`write.ai.style.${style.id}.name`)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="diary-write__ai-source-example-note diary-write__ai-source-example-note--sub">
                    {t('write.ai.sourceTutPhotoBody')}
                  </p>
                </div>
              ) : null}
              {aiSourceTutPanel == null ? (
                <div className="diary-write__ai-source-list">
                  <button
                    type="button"
                    className={[
                      'diary-write__ai-source-btn',
                      aiSourceTutProgress === 'need-diary'
                        ? 'diary-write__ai-source-btn--pulse'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={t('write.ai.sourceDiary')}
                    onClick={proceedDiaryDraw}
                  >
                    <span className="diary-write__ai-source-desc diary-write__ai-source-desc--solo">
                      {aiSourceTutProgress === 'need-diary'
                        ? t('write.ai.sourceTutDiaryTap')
                        : t('write.ai.sourceDiaryDesc')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={[
                      'diary-write__ai-source-btn',
                      aiSourceTutProgress === 'need-photo'
                        ? 'diary-write__ai-source-btn--pulse'
                        : '',
                      aiSourceTutProgress === 'need-diary'
                        ? 'diary-write__ai-source-btn--locked'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={t('write.ai.sourcePhoto')}
                    aria-disabled={aiSourceTutProgress === 'need-diary'}
                    disabled={aiSourceTutProgress === 'need-diary'}
                    onClick={openPhotoStylePicker}
                  >
                    <span className="diary-write__ai-source-desc diary-write__ai-source-desc--solo">
                      {aiSourceTutProgress === 'need-diary'
                        ? t('write.ai.sourceTutPhotoLocked')
                        : aiSourceTutProgress === 'need-photo'
                          ? t('write.ai.sourceTutPhotoTap')
                          : t('write.ai.sourcePhotoDesc')}
                    </span>
                  </button>
                </div>
              ) : null}
            </AppModal>
          )}
          {aiStyleOpen && (
            <AppModal
              title={t('write.ai.styleTitle')}
              panelClassName="app-modal__panel--ai-style"
              onDismiss={() => {
                setAiStyleOpen(false);
                setAiPhotoError(null);
              }}
              onBack={() => {
                setAiStyleOpen(false);
                setAiPhotoError(null);
                setAiSourceOpen(true);
              }}
              backAriaLabel={t('common.back')}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('write.ai.styleConfirm')}
              onPrimary={() => {
                if (!aiReferenceImage) {
                  setAiPhotoError(t('write.err.aiNeedPhoto'));
                  return;
                }
                if (!isAiDrawStyleEnabled(aiStyleSelectedId)) {
                  setAiPhotoError(t('write.ai.styleDisabled'));
                  return;
                }
                proceedAfterStylePick(aiStyleSelectedId);
              }}
            >
              <div className="diary-write__ai-photo">
                <p className="diary-write__ai-photo-label">{t('write.ai.photoLabel')}</p>
                <input
                  ref={aiPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="diary-write__ai-photo-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    void handleAiPhotoPick(file);
                  }}
                />
                {aiReferenceImage ? (
                  <div className="diary-write__ai-photo-preview-wrap">
                    <img
                      src={aiReferenceImage}
                      alt=""
                      className="diary-write__ai-photo-preview"
                    />
                    <div className="diary-write__ai-photo-actions">
                      <button
                        type="button"
                        className="diary-write__ai-photo-btn"
                        onClick={() => aiPhotoInputRef.current?.click()}
                      >
                        {t('write.ai.photoChange')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="diary-write__ai-photo-add"
                    onClick={() => aiPhotoInputRef.current?.click()}
                  >
                    {t('write.ai.photoAdd')}
                  </button>
                )}
                {aiPhotoError ? (
                  <p className="diary-write__ai-error" role="alert">
                    {aiPhotoError}
                  </p>
                ) : null}
              </div>

              <div className="diary-write__ai-styles" role="list">
                {AI_DRAW_STYLES.map((style) => {
                  const selected = aiStyleSelectedId === style.id;
                  const enabled = style.enabled !== false;
                  const coverSrc = style.previewSrcs[0]
                    ? aiStylePreviewSrc(style.previewSrcs[0])
                    : '';
                  const coverReady = coverSrc.startsWith('blob:');
                  return (
                    <button
                      key={style.id}
                      type="button"
                      role="listitem"
                      className={[
                        'diary-write__ai-style-item',
                        selected ? 'is-selected' : '',
                        !enabled ? 'is-disabled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-pressed={selected}
                      aria-label={t(`write.ai.style.${style.id}.name`)}
                      disabled={!enabled}
                      onClick={() => {
                        if (!enabled) return;
                        setAiStyleSelectedId(style.id);
                      }}
                    >
                      {coverReady ? (
                        <img
                          src={coverSrc}
                          alt=""
                          className="diary-write__ai-style-cover"
                          decoding="async"
                        />
                      ) : (
                        <span className="diary-write__ai-style-cover diary-write__ai-style-cover--empty" />
                      )}
                      <span
                        className={[
                          'diary-write__ai-style-name',
                          style.id === 'jpRetroFilm'
                            ? ''
                            : 'diary-write__ai-style-name--center',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {t(`write.ai.style.${style.id}.name`)}
                        {!enabled ? (
                          <span className="diary-write__ai-style-soon">
                            {' '}
                            {t('write.ai.styleSoon')}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </AppModal>
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
          {aiLoginOpen && (
            <AppModal
              title={t('write.ai.loginForFreeTitle')}
              lead={t('write.ai.guestPaywallLead')}
              onDismiss={() => {
                if (aiLoginBusy) return;
                setAiLoginOpen(false);
                setAiLoginError(null);
              }}
              showClose={!aiLoginBusy}
              closeAriaLabel={t('common.close')}
              primaryLabel={
                aiLoginBusy ? t('write.ai.loginBusy') : t('write.ai.loginSkipCta')
              }
              onPrimary={
                aiLoginBusy
                  ? undefined
                  : () => {
                      setAiLoginOpen(false);
                      void handleWatchAd();
                    }
              }
              secondaryLabel={aiLoginBusy ? undefined : t('header.subscribeCta')}
              onSecondary={
                aiLoginBusy
                  ? undefined
                  : () => {
                      setAiLoginOpen(false);
                      openNyangTicket();
                    }
              }
            >
              {aiLoginError && (
                <p className="diary-write__ai-login-error" role="alert">
                  {aiLoginError}
                </p>
              )}
            </AppModal>
          )}
          {rewardPromptOpen && (
            <AppModal
              title={t('write.ai.rewardTitle')}
              lead={t('write.ai.guestPaywallLead')}
              onDismiss={() => {
                clearPurchaseShield();
                setRewardPromptOpen(false);
              }}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('write.ai.loginSkipCta')}
              onPrimary={() => void handleWatchAd()}
              secondaryLabel={t('header.subscribeCta')}
              onSecondary={() => {
                clearPurchaseShield();
                setRewardPromptOpen(false);
                openNyangTicket();
              }}
            />
          )}
          {aiDailyLimitOpen && (
            <AppModal
              title={t('write.ai.chargeTitle')}
              lead={t('write.ai.guestDailyExhaustedLead')}
              onDismiss={() => {
                clearPurchaseShield();
                setAiDailyLimitOpen(false);
              }}
              showClose
              closeAriaLabel={t('common.close')}
              primaryLabel={t('header.subscribeCta')}
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
