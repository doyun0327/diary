import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Header from "./components/Header";
import CharacterSetup from "./components/CharacterSetup";
import ProfileSetup from "./components/ProfileSetup";
import AccountSheet from "./components/AccountSheet";
import LanguageSheet from "./components/LanguageSheet";
import NyangTicketSheet from "./components/NyangTicketSheet";
import ScreenLockGate from "./components/ScreenLockGate";
import PinSetupScreen from "./components/PinSetupScreen";
import PinVerifyScreen from "./components/PinVerifyScreen";
import ExportSheet from "./components/ExportSheet";
import DecorateSheet from "./components/DecorateSheet";
import AppInfoSheet from "./components/AppInfoSheet";
import SearchSheet from "./components/SearchSheet";
import AppModal from "./components/AppModal";
import CloudSyncLoadingOverlay from "./components/CloudSyncLoadingOverlay";
import SubscriptionBenefitsSwipe from "./components/SubscriptionBenefitsSwipe";
import { applyStoredFont } from "./components/FontPicker";
import DiaryBookViewer from "./components/DiaryBookViewer";
import DiaryListPage from "./pages/DiaryListPage";
import DiaryWritePage from "./pages/DiaryWritePage";
import DiaryDetailPage from "./pages/DiaryDetailPage";
import RoomsHubPage from "./pages/RoomsHubPage";
import RoomPage from "./pages/RoomPage";
import RoomPostPage from "./pages/RoomPostPage";
import { useDiary } from "./hooks/useDiary";
import { useDeployMaintenance } from "./hooks/useDeployMaintenance";
import { useCharacter } from "./hooks/useCharacter";
import { useClientProfile } from "./hooks/useClientProfile";
import { useScreenLock } from "./hooks/useScreenLock";
import {
  getAccessToken,
  getAuthSession,
  isGoogleSignedIn,
  useAuthSession,
  AUTH_CHANGE_EVENT,
  GOOGLE_REAUTH_EVENT,
  tryRecoverGoogleSession,
} from "./hooks/useAuthSession";
import {
  usePushOpenHandler,
  usePushRegistration,
} from "./hooks/usePushRegistration";
import {
  isProfileSetupDone,
  markProfileSetupDone,
} from "./utils/onboarding";
import type { DiaryEntry } from "./types/diary";
import { formatYearMonth, monthKey, today } from "./utils/date";
import type { SyncCloudOptions } from "./api/diariesApi";
import { isFlutterApp, postDiaryNative } from "./utils/nativeShare";
import {
  clearWriteDraft,
  loadWriteDraft,
  requestDraftFlush,
  saveWriteDraft,
} from "./utils/writeDraft";
import { syncSharedDiaryAfterDelete, syncSharedDiaryAfterEdit } from "./utils/syncSharedDiary";
import { prefetchRoomFeed, prefetchRoomsList } from "./utils/roomPrefetch";
import { roomsNeedGoogleLogin } from "./utils/roomsAuthGate";
import { preloadMoodPackIcons } from "./utils/moodPack";
import { preloadCharacterHairIcons } from "./types/character";
import { preloadAiStylePreviews } from "./utils/aiDrawStyles";
import { preloadNyangTicketImages } from "./utils/nyangTicketImages";
import {
  captureInviteFromLocation,
  isValidInviteCode,
  normalizeInviteCode,
  takePendingRoomInvite,
  tryOpenAppOrStore,
} from "./utils/roomInvite";
import {
  applyAiPackCreditsFromServer,
  applyMonthlyUsageFromServer,
  canUseProAiQuota,
  getDiaryAccessState,
  getProBillingPeriodEndMs,
  setDiaryAccessAccountId,
  subscribeDiaryAccess,
  SUBSCRIPTION_CHANGE_EVENT,
} from "./utils/diaryAccess";
import {
  fetchAiPackCredits,
  fetchMonthlyUsage,
} from "./api/usageApi";
import {
  identifySubscriptionUser,
  installSubscriptionBridge,
  REQUIRE_GOOGLE_FOR_PRO_EVENT,
  restoreSubscriptionAfterAuth,
  syncSubscriptionFromNative,
} from "./utils/subscription";
import {
  OPEN_NYANG_TICKET_EVENT,
  type OpenNyangTicketDetail,
} from "./utils/openNyangTicket";
import {
  clearPendingNyangPurchase,
  takePendingNyangPurchase,
  type PendingNyangPurchase,
} from "./utils/pendingNyangPurchase";
import "./App.css";

export type Page = "home" | "write" | "detail" | "rooms" | "room" | "room-post";

type SubscriptionModalReason = "write" | "search" | "export";

const PAGEBY_AFTER_SAVE_PROMPT_KEY = "pageby-after-save-prompt-seen";

function hasSeenPagebyAfterSavePrompt(): boolean {
  try {
    return localStorage.getItem(PAGEBY_AFTER_SAVE_PROMPT_KEY) === "1";
  } catch {
    return true;
  }
}

function markPagebyAfterSavePromptSeen(): void {
  try {
    localStorage.setItem(PAGEBY_AFTER_SAVE_PROMPT_KEY, "1");
  } catch {
    /* ignore */
  }
}

function App() {
  const { t } = useTranslation();
  const { entries, addEntry, updateEntry, removeEntry, clearLocalDiaries, syncWithCloud, ready } =
    useDiary();
  const { session, markSynced, ensureGuestSession, refreshMe } = useAuthSession();
  const googleReauthToastShownRef = useRef(false);
  const { character, setCharacter } = useCharacter();
  const { clientId, nickname, setNickname, avatarUrl, setAvatarUrl, gender, setGender, ageGroup, setAgeGroup } =
    useClientProfile();
  const screenLock = useScreenLock();
  const [page, setPage] = useState<Page>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 메인 달력에서 고른 날짜 — 새 일기 작성 시 사용 */
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [nyangTicketOpen, setNyangTicketOpen] = useState(false);
  const [nyangTicketTab, setNyangTicketTab] = useState<
    'subscribe' | 'packs' | 'history'
  >('subscribe');
  const [nyangAutoPurchase, setNyangAutoPurchase] =
    useState<PendingNyangPurchase | null>(null);
  const [lockSetupOpen, setLockSetupOpen] = useState(false);
  const [lockDisableOpen, setLockDisableOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [decorateOpen, setDecorateOpen] = useState(false);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [bookEntries, setBookEntries] = useState<DiaryEntry[] | null>(null);
  const [bookRange, setBookRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  /** 초대 링크로 받은 코드 — RoomsHub에서 자동 입장 후 소거 */
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(
    null,
  );
  const [subscriptionModal, setSubscriptionModal] =
    useState<SubscriptionModalReason | null>(null);
  const [writeSaveEnabled, setWriteSaveEnabled] = useState(true);
  const [writeSaving, setWriteSaving] = useState(false);
  const [googleLoginForProOpen, setGoogleLoginForProOpen] = useState(false);
  const [pagebyAfterSavePromptOpen, setPagebyAfterSavePromptOpen] =
    useState(false);
  const [calendarHighlightDate, setCalendarHighlightDate] = useState<
    string | null
  >(null);
  const calendarHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** 방 피드에서 방금 공유한 일기 카드 반짝 */
  const [roomHighlightDiaryId, setRoomHighlightDiaryId] = useState<string | null>(
    null,
  );
  const [accessTick, setAccessTick] = useState(0);
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);
  const deployUpdating = useDeployMaintenance();

  useEffect(() => {
    return () => {
      if (calendarHighlightTimerRef.current) {
        clearTimeout(calendarHighlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (deployUpdating) requestDraftFlush();
  }, [deployUpdating]);

  useEffect(() => {
    const run = () => {
      preloadMoodPackIcons();
      preloadCharacterHairIcons();
      preloadAiStylePreviews();
      preloadNyangTicketImages();
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 300);
    return () => window.clearTimeout(t);
  }, []);

  const fetchedProUsageUserRef = useRef<string | null>(null);
  const fetchedAiPackUserRef = useRef<string | null>(null);
  const [appToast, setAppToast] = useState<string | null>(null);
  const appToastTimer = useRef<number | null>(null);

  const accessStatus = getDiaryAccessState(entries.length);

  // 복원된 수정 id 가 목록에 없으면 새 글로 이어서 작성
  useEffect(() => {
    if (!ready || !editingId) return;
    if (entries.some((entry) => entry.id === editingId)) return;
    const draft = loadWriteDraft();
    if (draft?.editingId === editingId) {
      saveWriteDraft({
        date: draft.date,
        title: draft.title,
        content: draft.content,
        mood: draft.mood,
        fontId: draft.fontId,
        fontSize: draft.fontSize,
        hasDrawing: draft.hasDrawing,
        editingId: null,
      });
    }
    setEditingId(null);
  }, [ready, editingId, entries]);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const [onboardingTick, setOnboardingTick] = useState(0);
  const needsProfileSetup = !isProfileSetupDone();
  void onboardingTick;

  useEffect(() => {
    applyStoredFont();
    const cleanupBridge = installSubscriptionBridge();
    const unsubAccess = subscribeDiaryAccess(() =>
      setAccessTick((n) => n + 1),
    );
    return () => {
      cleanupBridge();
      unsubAccess();
    };
  }, []);

  useEffect(() => {
    if (!isFlutterApp()) return;
    syncSubscriptionFromNative();
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenNyangTicketDetail>).detail;
      setNyangTicketTab(
        detail?.tab === 'packs'
          ? 'packs'
          : detail?.tab === 'history'
            ? 'history'
            : 'subscribe',
      );
      setNyangTicketOpen(true);
    };
    window.addEventListener(OPEN_NYANG_TICKET_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NYANG_TICKET_EVENT, onOpen);
  }, []);

  useEffect(() => {
    setDiaryAccessAccountId(session?.userId ?? clientId);
  }, [session?.userId, clientId]);

  useEffect(() => {
    if (!isFlutterApp()) return;
    const userId = session?.userId ?? clientId;
    if (userId) {
      // Google 로그인·계정 전환 시 스토어 구독 복원 → "구독 중" 유지
      if (session?.provider === "google") {
        restoreSubscriptionAfterAuth(userId);
      } else {
        identifySubscriptionUser(userId);
        syncSubscriptionFromNative();
      }
    }
  }, [session?.userId, session?.provider, clientId]);

  // Google 로그인 완료 직후 Pro 재동기화 (토큰 만료 후 재로그인 포함)
  useEffect(() => {
    const onAuth = () => {
      if (!isGoogleSignedIn()) return;
      const auth = getAuthSession();
      restoreSubscriptionAfterAuth(auth?.userId ?? null);
      setAccessTick((n) => n + 1);

      const pending = takePendingNyangPurchase();
      if (!pending) return;
      setGoogleLoginForProOpen(false);
      setAccountOpen(false);
      setNyangAutoPurchase(pending);
      setNyangTicketTab(pending.kind === "pack" ? "packs" : "subscribe");
      setNyangTicketOpen(true);
    };
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onAuth);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    const userId = session?.userId;
    if (!token || !userId) {
      fetchedProUsageUserRef.current = null;
      fetchedAiPackUserRef.current = null;
      return;
    }

    if (fetchedAiPackUserRef.current !== userId) {
      fetchedAiPackUserRef.current = userId;
      void fetchAiPackCredits(token)
        .then((view) => applyAiPackCreditsFromServer(view.credits))
        .catch(() => {
          fetchedAiPackUserRef.current = null;
        });
    }

    if (!canUseProAiQuota()) {
      return;
    }
    const periodEnd = getProBillingPeriodEndMs();
    const usageFetchKey = `${userId}:${periodEnd ?? "none"}`;
    if (fetchedProUsageUserRef.current === usageFetchKey) return;
    fetchedProUsageUserRef.current = usageFetchKey;
    void fetchMonthlyUsage(token)
      .then((usage) =>
        applyMonthlyUsageFromServer(usage.used, usage.yearMonth),
      )
      .catch(() => {
        fetchedProUsageUserRef.current = null;
      });
  }, [session?.userId, accessTick]);

  useEffect(() => {
    const onNeedGoogle = () => {
      setSubscriptionModal(null);
      setNyangTicketOpen(false);
      setGoogleLoginForProOpen(true);
    };
    window.addEventListener(REQUIRE_GOOGLE_FOR_PRO_EVENT, onNeedGoogle);
    return () =>
      window.removeEventListener(REQUIRE_GOOGLE_FOR_PRO_EVENT, onNeedGoogle);
  }, []);

  const closeSubscriptionModal = useCallback(() => {
    setSubscriptionModal(null);
  }, []);

  const pendingSearchSelectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!subscriptionModal) return;
    const onSubscriptionChange = () => {
      const next = getDiaryAccessState(entries.length);
      if (subscriptionModal === "write" && next.canCreate) {
        closeSubscriptionModal();
        setEditingId(null);
        setPage("write");
        return;
      }
      if (
        (subscriptionModal === "search" || subscriptionModal === "export") &&
        next.canUseSearchAndExport
      ) {
        const reason = subscriptionModal;
        closeSubscriptionModal();
        if (reason === "search") {
          const id = pendingSearchSelectRef.current;
          pendingSearchSelectRef.current = null;
          if (id) {
            setSearchOpen(false);
            setSelectedId(id);
            setEditingId(null);
            setPage("detail");
          }
          return;
        }
        if (reason === "export" && !bookEntries) setExportOpen(true);
      }
    };
    window.addEventListener(SUBSCRIPTION_CHANGE_EVENT, onSubscriptionChange);
    return () =>
      window.removeEventListener(SUBSCRIPTION_CHANGE_EVENT, onSubscriptionChange);
  }, [subscriptionModal, entries.length, bookEntries, closeSubscriptionModal]);

  // Google로 보이는 세션이면 /me 로 서버에서도 한 번 확인 (폐기·만료 대응)
  useEffect(() => {
    if (needsProfileSetup) return;
    if (getAuthSession()?.provider !== "google") return;
    if (!getAccessToken()) return; // 만료 복구는 tryRecoverGoogleSession 이 담당
    void refreshMe();
  }, [needsProfileSetup, refreshMe, session?.userId]);

  useEffect(() => {
    if (needsProfileSetup) return;
    if (getAccessToken()) return;
    // Google 로그아웃 직후엔 자동 게스트 세션 만들지 않음 (재로그인 유도)
    if (roomsNeedGoogleLogin()) return;
    const nick = nickname.trim() || t("common.anonymous");
    void ensureGuestSession(clientId, nick)
      .then(() => prefetchRoomsList())
      .catch((err) => {
      console.warn("[guest] auto session failed", err);
    });
  }, [needsProfileSetup, clientId, nickname, ensureGuestSession, t, session?.provider]);

  usePushRegistration(!needsProfileSetup, session?.userId ?? clientId);

  const openFromPush = useCallback(
    (payload: { type?: string; roomId: string; postId?: string }) => {
      setActiveRoomId(payload.roomId);
      if (payload.postId) {
        setActivePostId(payload.postId);
        setPage("room-post");
        return;
      }
      setActivePostId(null);
      setPage("room");
    },
    [],
  );
  usePushOpenHandler(openFromPush);

  const selectedEntry = entries.find((e) => e.id === selectedId);
  const editingEntry = editingId
    ? entries.find((e) => e.id === editingId)
    : undefined;

  const entriesByDate = useMemo(
    () =>
      [...entries].sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const byCreated = a.createdAt.localeCompare(b.createdAt);
        if (byCreated !== 0) return byCreated;
        return a.id.localeCompare(b.id);
      }),
    [entries],
  );

  const detailAdjacent = useMemo(() => {
    if (!selectedEntry) return { prev: null, next: null };
    const index = entriesByDate.findIndex((e) => e.id === selectedEntry.id);
    if (index < 0) return { prev: null, next: null };
    return {
      prev: index > 0 ? entriesByDate[index - 1] : null,
      next: index < entriesByDate.length - 1 ? entriesByDate[index + 1] : null,
    };
  }, [entriesByDate, selectedEntry]);

  const handleSelect = (id: string) => {
    setSearchOpen(false);
    setSelectedId(id);
    setEditingId(null);
    setPage("detail");
  };

  const handleDetailNavigate = useCallback(
    (direction: "prev" | "next") => {
      const target =
        direction === "prev" ? detailAdjacent.prev : detailAdjacent.next;
      if (!target) return;
      setSelectedId(target.id);
      setSelectedDate(target.date);
    },
    [detailAdjacent],
  );

  const handleSearchSelect = (id: string) => {
    handleSelect(id);
  };

  const syncChainRef = useRef<Promise<void>>(Promise.resolve());
  const startupSyncQueuedRef = useRef(false);
  const prevCalendarMonthRef = useRef<string | null>(null);

  const viewMonthKey = monthKey(calYear, calMonth);

  /** 공유 피커 — 이전 달 일기 클라우드 pull */
  const pullMonthDiaries = useCallback(
    async (month: string) => {
      const auth = getAuthSession();
      if (!getAccessToken() || auth?.provider !== "google") return 0;
      const result = await syncWithCloud(null, { month, pullOnly: true });
      markSynced(result.serverTime);
      return result.pulledCount ?? 0;
    },
    [syncWithCloud, markSynced],
  );

  /** Google 로그인 중이면 서버와 LWW 동기화 (업·다운로드) */
  const queueCloudSync = useCallback(
    (options?: SyncCloudOptions & { showLoading?: boolean }) => {
      const auth = getAuthSession();
      if (!getAccessToken() || auth?.provider !== "google") return;

      const showLoading = options?.showLoading === true;
      if (showLoading) setCloudSyncLoading(true);

      syncChainRef.current = syncChainRef.current
        .then(async () => {
          try {
            const latest = getAuthSession();
            if (!getAccessToken() || latest?.provider !== "google") return;
            const pullOnly = options?.pullOnly === true;
            const month = options?.month ?? viewMonthKey;
            const result = await syncWithCloud(
              pullOnly ? null : latest.lastSyncedAt ?? null,
              {
                month,
                pullOnly,
              },
            );
            markSynced(result.serverTime);
          } finally {
            if (showLoading) setCloudSyncLoading(false);
          }
        })
        .catch((err) => {
          console.warn("[sync] cloud sync failed", err);
          if (showLoading) setCloudSyncLoading(false);
        });
    },
    [syncWithCloud, markSynced, viewMonthKey],
  );

  useEffect(() => {
    if (session?.provider !== "google") {
      startupSyncQueuedRef.current = false;
      prevCalendarMonthRef.current = null;
    }
  }, [session?.provider, session?.userId]);

  /** 앱 켤 때 — 현재 달만 동기화 */
  useEffect(() => {
    if (!ready || startupSyncQueuedRef.current) return;
    const auth = getAuthSession();
    if (!getAccessToken() || auth?.provider !== "google") return;
    startupSyncQueuedRef.current = true;
    prevCalendarMonthRef.current = viewMonthKey;
    queueCloudSync({ month: viewMonthKey });
  }, [ready, queueCloudSync, viewMonthKey]);

  /** 달력에서 다른 달로 이동할 때 — 해당 달만 받기 */
  useEffect(() => {
    if (!ready || page !== "home") return;
    const auth = getAuthSession();
    if (!getAccessToken() || auth?.provider !== "google") return;

    if (prevCalendarMonthRef.current === null) {
      prevCalendarMonthRef.current = viewMonthKey;
      return;
    }
    if (prevCalendarMonthRef.current === viewMonthKey) return;

    prevCalendarMonthRef.current = viewMonthKey;
    queueCloudSync({ month: viewMonthKey, pullOnly: true, showLoading: true });
  }, [calYear, calMonth, ready, page, queueCloudSync, viewMonthKey]);

  /** 저장·삭제 직후 — 현재 달 기준 동기화 */
  const syncInBackground = useCallback(() => {
    queueCloudSync({ month: viewMonthKey });
  }, [queueCloudSync, viewMonthKey]);

  useEffect(() => {
    return () => {
      if (appToastTimer.current != null) window.clearTimeout(appToastTimer.current);
    };
  }, []);

  const showAppToast = useCallback((msg: string, durationMs = 1800) => {
    setAppToast(msg);
    if (appToastTimer.current != null) window.clearTimeout(appToastTimer.current);
    appToastTimer.current = window.setTimeout(() => setAppToast(null), durationMs);
  }, []);

  // Google JWT 만료·소실 — 같은 기기는 조용히 재발급, 안 되면 로그인 화면
  useEffect(() => {
    let cancelled = false;
    const openReauth = () => {
      setGoogleLoginForProOpen(false);
      setAccountOpen(true);
      if (!googleReauthToastShownRef.current) {
        googleReauthToastShownRef.current = true;
        showAppToast(t("account.sync.sessionExpired"), 2800);
      }
    };
    const check = () => {
      const auth = getAuthSession();
      if (auth?.provider !== "google") return;
      if (getAccessToken()) return;
      const nick = nickname.trim() || t("common.anonymous");
      void tryRecoverGoogleSession(clientId, nick).then((result) => {
        if (cancelled) return;
        if (result === "restored") {
          setAccountOpen(false);
          googleReauthToastShownRef.current = false;
          const userId = getAuthSession()?.userId;
          restoreSubscriptionAfterAuth(userId ?? null);
          queueCloudSync({ month: viewMonthKey, showLoading: false });
          setAccessTick((n) => n + 1);
          return;
        }
        if (result === "need-reauth") openReauth();
      });
    };
    const onReauth = () => openReauth();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    window.addEventListener(GOOGLE_REAUTH_EVENT, onReauth);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      window.removeEventListener(GOOGLE_REAUTH_EVENT, onReauth);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [showAppToast, t, clientId, nickname, queueCloudSync, viewMonthKey]);

  useEffect(() => {
    if (!isGoogleSignedIn()) return;
    googleReauthToastShownRef.current = false;
  }, [session?.provider, session?.userId]);

  const pulseCalendarHighlight = useCallback(
    (savedDate: string, durationMs = 1600) => {
      const [y, m] = savedDate.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(m)) {
        setCalYear(y);
        setCalMonth(m - 1);
      }
      setSelectedDate(savedDate);
      if (calendarHighlightTimerRef.current) {
        clearTimeout(calendarHighlightTimerRef.current);
      }
      setCalendarHighlightDate(savedDate);
      calendarHighlightTimerRef.current = setTimeout(() => {
        setCalendarHighlightDate(null);
        calendarHighlightTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  const persistNewEntry = useCallback(
    async (entry: Omit<DiaryEntry, "id" | "createdAt" | "updatedAt">) => {
      await addEntry(entry);
      pulseCalendarHighlight(entry.date);
      setPage("home");
      syncInBackground();
      showAppToast(t("write.savedToast"));
      if (!hasSeenPagebyAfterSavePrompt()) {
        setPagebyAfterSavePromptOpen(true);
      }
    },
    [addEntry, pulseCalendarHighlight, showAppToast, syncInBackground, t],
  );

  const persistDiarySave = useCallback(
    async (
      entry: Omit<DiaryEntry, "id" | "createdAt" | "updatedAt"> & {
        clearDrawing?: boolean;
      },
      editId: string | null,
    ) => {
      if (editId) {
        await updateEntry(editId, entry);
        setSelectedId(null);
        setEditingId(null);
        pulseCalendarHighlight(entry.date);
        setPage("home");
        void syncSharedDiaryAfterEdit(editId, entry);
        syncInBackground();
        showAppToast(t("write.updatedToast"));
        return;
      }
      await persistNewEntry(entry);
    },
    [
      persistNewEntry,
      pulseCalendarHighlight,
      showAppToast,
      syncInBackground,
      t,
      updateEntry,
    ],
  );

  const handleSave: Parameters<typeof DiaryWritePage>[0]["onSave"] = (
    entry,
  ) => {
    return (async () => {
      try {
        const editId = editingId;

        if (editId) {
          await persistDiarySave(entry, editId);
          return;
        }

        await persistNewEntry(entry);
      } catch (err) {
        console.error("[diary] save failed", err);
        throw err instanceof Error
          ? err
          : new Error("일기 저장에 실패했어요");
      }
    })();
  };

  const handleDelete = (id: string) => {
    removeEntry(id);
    setSelectedId(null);
    setEditingId(null);
    setPage("home");
    void syncSharedDiaryAfterDelete(id);
    syncInBackground();
  };

  const handleEdit = () => {
    if (!selectedId) return;
    setEditingId(selectedId);
    setPage("write");
  };

  const handleWriteCancel = () => {
    if (editingId) {
      setEditingId(null);
      setPage("detail");
      return;
    }
    setPage("home");
  };

  const goBack = useCallback((): boolean => {
    if (screenLock.locked) return true;
    if (bookEntries) {
      setBookEntries(null);
      setBookRange(null);
      return true;
    }
    if (appInfoOpen) {
      setAppInfoOpen(false);
      return true;
    }
    if (decorateOpen) {
      setDecorateOpen(false);
      return true;
    }
    if (exportOpen) {
      setExportOpen(false);
      return true;
    }
    if (searchOpen) {
      setSearchOpen(false);
      return true;
    }
    if (characterOpen) {
      setCharacterOpen(false);
      return true;
    }
    if (lockDisableOpen) {
      setLockDisableOpen(false);
      return true;
    }
    if (lockSetupOpen) {
      setLockSetupOpen(false);
      return true;
    }
    if (languageOpen) {
      setLanguageOpen(false);
      return true;
    }
    if (nyangTicketOpen) {
      setNyangTicketOpen(false);
      return true;
    }
    if (googleLoginForProOpen) {
      setGoogleLoginForProOpen(false);
      return true;
    }
    if (accountOpen) {
      setAccountOpen(false);
      return true;
    }
    if (page === "room-post") {
      setActivePostId(null);
      setPage("room");
      return true;
    }
    if (page === "room") {
      setActivePostId(null);
      setPage("rooms");
      return true;
    }
    if (page === "rooms") {
      setPage("home");
      return true;
    }
    if (page === "detail") {
      setPage("home");
      return true;
    }
    if (page === "write") {
      window.dispatchEvent(new Event("diary-write-cancel"));
      return true;
    }
    return false;
  }, [
    accountOpen,
    googleLoginForProOpen,
    appInfoOpen,
    bookEntries,
    characterOpen,
    decorateOpen,
    editingId,
    exportOpen,
    searchOpen,
    languageOpen,
    nyangTicketOpen,
    lockDisableOpen,
    lockSetupOpen,
    page,
    screenLock.locked,
  ]);

  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    window.diaryGoBack = () => goBackRef.current();
    const onNativeBack = () => {
      goBackRef.current();
    };
    window.addEventListener("diary-native-back", onNativeBack);
    return () => {
      delete window.diaryGoBack;
      window.removeEventListener("diary-native-back", onNativeBack);
    };
  }, []);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (
        el?.closest(
          '[data-no-swipe], input, textarea, button, a, [contenteditable="true"]',
        )
      ) {
        return;
      }
      tracking = true;
      startX = clientX;
      startY = clientY;
    };

    const onEnd = (clientX: number, clientY: number) => {
      if (!tracking) return;
      tracking = false;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (dx > 56 && Math.abs(dy) < 110 && dx > Math.abs(dy) * 1.15) {
        goBackRef.current();
      }
    };

    const onPointerStart = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      onStart(e.clientX, e.clientY);
    };
    const onPointerEnd = (e: PointerEvent) => onEnd(e.clientX, e.clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    };
    const onCancel = () => {
      tracking = false;
    };

    const opts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("pointerdown", onPointerStart, opts);
    window.addEventListener("pointerup", onPointerEnd, opts);
    window.addEventListener("pointercancel", onCancel, opts);
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("touchcancel", onCancel, opts);
    return () => {
      window.removeEventListener("pointerdown", onPointerStart, opts);
      window.removeEventListener("pointerup", onPointerEnd, opts);
      window.removeEventListener("pointercancel", onCancel, opts);
      window.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchend", onTouchEnd, opts);
      window.removeEventListener("touchcancel", onCancel, opts);
    };
  }, []);

  const openWritePage = (date?: string) => {
    if (date) setSelectedDate(date);
    setEditingId(null);
    clearWriteDraft();
    setPage("write");
  };

  const openRooms = () => {
    void prefetchRoomsList();
    setActiveRoomId(null);
    setActivePostId(null);
    setPage("rooms");
  };

  // 초대 딥링크: URL·Flutter 주입 → (브라우저면 앱/스토어만, 웹 입장 차단)
  useEffect(() => {
    const applyInvite = (raw: string | null | undefined) => {
      const code = normalizeInviteCode(raw);
      if (!isValidInviteCode(code)) return false;
      setPendingInviteCode(code);
      return true;
    };

    const fromBoot = captureInviteFromLocation();
    if (fromBoot) {
      if (!isFlutterApp()) {
        // 웹 브라우저: 앱·스토어로만 보냄 (친구방 웹 자동입장 금지)
        takePendingRoomInvite();
        tryOpenAppOrStore(fromBoot);
      } else {
        applyInvite(fromBoot);
      }
    }

    const onInviteEvent = () => {
      const code = captureInviteFromLocation();
      if (applyInvite(code)) {
        void prefetchRoomsList();
        setActiveRoomId(null);
        setActivePostId(null);
        setPage("rooms");
      }
    };
    window.addEventListener("diary-invite-open", onInviteEvent);
    return () => window.removeEventListener("diary-invite-open", onInviteEvent);
  }, []);

  // 프로필 설정이 끝난 뒤에야 방 허브로 이동
  useEffect(() => {
    if (needsProfileSetup || !pendingInviteCode) return;
    if (page === "rooms" || page === "room" || page === "room-post") return;
    openRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초대 대기 중 1회
  }, [needsProfileSetup, pendingInviteCode]);

  // 화면 잠금 메뉴 임시 비활성
  // const handleToggleScreenLock = () => {
  //   if (screenLock.enabled) {
  //     setLockDisableOpen(true);
  //     return;
  //   }
  //   if (screenLock.hasPin) {
  //     screenLock.turnOn();
  //     return;
  //   }
  //   setLockSetupOpen(true);
  // };

  const moveCalendarMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  useEffect(() => {
    if (page !== "write") setWriteSaveEnabled(true);
  }, [page]);

  useEffect(() => {
    const syncNativeHeader = () => {
      const isWrite = page === "write";
      const isRoomsHub = page === "rooms";
      /** 친구방·상세·화면잠금처럼 웹 자체 툴바를 쓰는 화면 → Flutter AppBar 숨김 */
      const hideNativeChrome =
        page === "detail" ||
        page === "rooms" ||
        page === "room" ||
        page === "room-post" ||
        lockSetupOpen ||
        lockDisableOpen ||
        screenLock.locked;

      // Flutter가 isFlutterApp()/채널 타이밍과 무관하게 읽을 수 있게 항상 기록
      try {
        window.__diaryHideNativeChrome = hideNativeChrome;
      } catch {
        // ignore
      }

      const visible =
        !needsProfileSetup && !hideNativeChrome;

      // 무료 하단 배너: 홈·쓰기·PageBy·상세 등 (잠금·프로필 설정만 제외)
      const showBanner =
        !needsProfileSetup &&
        !lockSetupOpen &&
        !lockDisableOpen &&
        !screenLock.locked;

      // 채널만 있으면 전송 (isFlutterApp 게이트 제거 — 플래그 미설정 시에도 숨김 반영)
      postDiaryNative({
        type: "headerState",
        visible,
        showBanner,
        showCalendar: page === "home",
        showBack: isWrite,
        showSave: isWrite,
        showMenu: !isWrite && !isRoomsHub && visible,
        showSearch: !isWrite && !isRoomsHub && visible,
        year: calYear,
        month: calMonth,
        label:
          page === "home"
            ? formatYearMonth(calYear, calMonth)
            : "",
        saveLabel: writeSaving
          ? editingId
            ? t("write.savingEdit")
            : t("write.saving")
          : editingId
            ? t("write.saveEdit")
            : t("write.save"),
        saveEnabled: writeSaveEnabled,
      });
    };

    syncNativeHeader();
    window.addEventListener("diary-flutter-ready", syncNativeHeader);
    return () => {
      window.removeEventListener("diary-flutter-ready", syncNativeHeader);
    };
  }, [
    page,
    calYear,
    calMonth,
    needsProfileSetup,
    editingId,
    writeSaveEnabled,
    writeSaving,
    lockSetupOpen,
    lockDisableOpen,
    screenLock.locked,
    t,
  ]);

  if (needsProfileSetup) {
    return (
      <div className="app">
        <ProfileSetup
          initialName={nickname}
          initialAvatar={avatarUrl}
          initialGender={gender}
          initialAgeGroup={ageGroup}
          onComplete={({
            nickname: nextName,
            avatarUrl: nextAvatar,
            gender: nextGender,
            ageGroup: nextAge,
          }) => {
            setNickname(nextName);
            setAvatarUrl(nextAvatar);
            setGender(nextGender);
            setAgeGroup(nextAge);
            markProfileSetupDone();
            setOnboardingTick((n) => n + 1);
            void ensureGuestSession(clientId, nextName).catch((err) => {
              console.warn("[guest] session after profile setup failed", err);
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        hideBar={
          isFlutterApp() ||
          page === "detail" ||
          page === "rooms" ||
          page === "room" ||
          page === "room-post" ||
          lockSetupOpen ||
          lockDisableOpen ||
          screenLock.locked
        }
        nickname={nickname}
        avatarUrl={avatarUrl}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenNyangTicket={() => {
          setNyangTicketTab('subscribe');
          setNyangTicketOpen(true);
        }}
        // 화면 잠금 메뉴 임시 비활성
        // screenLockEnabled={screenLock.enabled}
        // onToggleScreenLock={handleToggleScreenLock}
        onOpenDecorate={() => setDecorateOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenRooms={openRooms}
        onOpenAppInfo={() => setAppInfoOpen(true)}
        onNativeBack={() => {
          if (page === "rooms") setPage("home");
          if (page === "write") {
            window.dispatchEvent(new Event("diary-write-cancel"));
          }
        }}
        onNativeSave={() => {
          window.dispatchEvent(new Event("diary-write-save"));
        }}
        calendarNav={{
          year: calYear,
          month: calMonth,
          onPrev: () => moveCalendarMonth(-1),
          onNext: () => moveCalendarMonth(1),
          onSelectMonth: (year, month) => {
            setCalYear(year);
            setCalMonth(month);
          },
        }}
      />
      <main
        className={
          page === "detail" ||
          page === "rooms" ||
          page === "room" ||
          page === "room-post"
            ? "app-main--overlay"
            : undefined
        }
      >
        {(page === "home" || page === "write" || page === "detail") && (
          <div
            className={
              page === "home" ? "app-home" : "app-home app-home--parked"
            }
            aria-hidden={page !== "home"}
          >
            <DiaryListPage
              entries={entries}
              onSelect={handleSelect}
              onWriteDate={openWritePage}
              viewYear={calYear}
              viewMonth={calMonth}
              selectedDate={selectedDate}
              highlightDate={calendarHighlightDate}
              onSelectDate={setSelectedDate}
              onViewChange={(year, month) => {
                setCalYear(year);
                setCalMonth(month);
              }}
            />
          </div>
        )}
        {page === "write" && (
          <DiaryWritePage
            key={editingId ?? `new-${selectedDate}`}
            initialEntry={editingEntry}
            initialDate={editingEntry ? undefined : selectedDate}
            onSave={handleSave}
            onCancel={handleWriteCancel}
            onNativeSaveStateChange={(enabled, saving) => {
              setWriteSaveEnabled(enabled);
              setWriteSaving(Boolean(saving));
            }}
            writeQuota={{
              used: accessStatus.monthlyUsed,
              limit: accessStatus.monthlyLimit,
            }}
            onAppToast={showAppToast}
          />
        )}
        {page === "detail" && selectedEntry && (
          <DiaryDetailPage
            key={selectedEntry.id}
            entry={selectedEntry}
            onBack={() => setPage("home")}
            onEdit={handleEdit}
            onWriteNew={() => {
              openWritePage(selectedEntry.date);
            }}
            onDelete={handleDelete}
            onGoPrevDay={() => handleDetailNavigate("prev")}
            onGoNextDay={() => handleDetailNavigate("next")}
            hasPrevDay={detailAdjacent.prev != null}
            hasNextDay={detailAdjacent.next != null}
            onOpenRooms={() => {
              setActiveRoomId(null);
              setActivePostId(null);
              setPage("rooms");
            }}
            onOpenRoom={(roomId, opts) => {
              void prefetchRoomFeed(roomId, { force: true });
              setRoomHighlightDiaryId(opts?.highlightDiaryId ?? null);
              setActiveRoomId(roomId);
              setActivePostId(null);
              setPage("room");
            }}
            onAppToast={showAppToast}
          />
        )}
        {page === "rooms" && (
          <RoomsHubPage
            nickname={nickname}
            avatarUrl={avatarUrl}
            clientId={clientId}
            userId={session?.userId ?? ""}
            ensureGuestSession={ensureGuestSession}
            onOpenAccount={() => setAccountOpen(true)}
            onBack={() => setPage("home")}
            pendingInviteCode={pendingInviteCode}
            onPendingInviteConsumed={() => {
              takePendingRoomInvite();
              setPendingInviteCode(null);
            }}
            onOpenRoom={(roomId) => {
              void prefetchRoomFeed(roomId, { force: true });
              setRoomHighlightDiaryId(null);
              setActiveRoomId(roomId);
              setActivePostId(null);
              setPage("room");
            }}
          />
        )}
        {page === "room" && activeRoomId && (
          <RoomPage
            roomId={activeRoomId}
            userId={session?.userId ?? ""}
            entries={entries}
            nickname={nickname}
            clientId={clientId}
            ensureGuestSession={ensureGuestSession}
            onPullMonthDiaries={pullMonthDiaries}
            onBack={() => {
              setActivePostId(null);
              setPage("rooms");
            }}
            onOpenPost={(postId) => {
              setActivePostId(postId);
              setPage("room-post");
            }}
            highlightDiaryId={roomHighlightDiaryId}
            onHighlightConsumed={() => setRoomHighlightDiaryId(null)}
          />
        )}
        {page === "room-post" && activeRoomId && activePostId && (
          <RoomPostPage
            roomId={activeRoomId}
            postId={activePostId}
            userId={session?.userId ?? ""}
            onBack={() => {
              setActivePostId(null);
              setPage("room");
            }}
          />
        )}
      </main>
      {accountOpen &&
        createPortal(
          <AccountSheet
            nickname={nickname}
            avatarUrl={avatarUrl}
            clientId={clientId}
            gender={gender}
            ageGroup={ageGroup}
            onNicknameChange={setNickname}
            onAvatarChange={setAvatarUrl}
            onGenderChange={setGender}
            onAgeGroupChange={setAgeGroup}
            onSyncDiaries={syncWithCloud}
            syncMonth={viewMonthKey}
            onMonthSynced={(month) => {
              prevCalendarMonthRef.current = month;
              startupSyncQueuedRef.current = true;
            }}
            onClearLocalDiaries={clearLocalDiaries}
            onCloudSessionEnded={() => {
              setActiveRoomId(null);
              setActivePostId(null);
              if (page === "room" || page === "room-post" || page === "rooms") {
                setPage("rooms");
              }
              setAccountOpen(true);
            }}
            onClose={() => setAccountOpen(false)}
            onCloudSyncLoadingChange={setCloudSyncLoading}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {cloudSyncLoading &&
        createPortal(
          <CloudSyncLoadingOverlay message={t("account.sync.loadingDiaries")} />,
          document.getElementById("root") ?? document.body,
        )}
      {deployUpdating &&
        createPortal(
          <CloudSyncLoadingOverlay message={t("common.deployUpdating")} />,
          document.getElementById("root") ?? document.body,
        )}
      {languageOpen &&
        createPortal(
          <LanguageSheet onClose={() => setLanguageOpen(false)} />,
          document.getElementById("root") ?? document.body,
        )}
      {nyangTicketOpen &&
        createPortal(
          <NyangTicketSheet
            key={nyangTicketTab}
            initialTab={nyangTicketTab}
            autoPurchase={nyangAutoPurchase}
            onAutoPurchaseConsumed={() => setNyangAutoPurchase(null)}
            onAppToast={showAppToast}
            onClose={() => {
              setNyangTicketOpen(false);
              setNyangAutoPurchase(null);
            }}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {lockSetupOpen &&
        createPortal(
          <PinSetupScreen
            onDone={async (pin) => {
              await screenLock.enableLock(pin);
              setLockSetupOpen(false);
            }}
            onCancel={() => setLockSetupOpen(false)}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {lockDisableOpen &&
        createPortal(
          <PinVerifyScreen
            title={t("lock.disableTitle")}
            hint={t("lock.disableHint")}
            onVerified={async (pin) => {
              const ok = await screenLock.disableLock(pin);
              if (ok) setLockDisableOpen(false);
              return ok;
            }}
            onCancel={() => setLockDisableOpen(false)}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {decorateOpen &&
        createPortal(
          <DecorateSheet onClose={() => setDecorateOpen(false)} />,
          document.getElementById("root") ?? document.body,
        )}
      {exportOpen &&
        createPortal(
          <ExportSheet
            entries={entries}
            onClose={() => setExportOpen(false)}
            onOpenBook={(filtered, range) => {
              setBookEntries(filtered);
              setBookRange(range);
              setExportOpen(false);
            }}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {searchOpen &&
        createPortal(
          <SearchSheet
            entries={entries}
            onClose={() => setSearchOpen(false)}
            onSelect={handleSearchSelect}
            canSearch={accessStatus.canUseSearchAndExport}
            onRequirePremium={() => {
              pendingSearchSelectRef.current = null;
              setSubscriptionModal("search");
            }}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {appInfoOpen &&
        createPortal(
          <AppInfoSheet onClose={() => setAppInfoOpen(false)} />,
          document.getElementById("root") ?? document.body,
        )}
      {characterOpen &&
        createPortal(
          <CharacterSetup
            character={character}
            onChange={setCharacter}
            onClose={() => {
              setCharacterOpen(false);
            }}
            onComplete={() => {
              setCharacterOpen(false);
            }}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {/* 화면 잠금 게이트 임시 비활성 (SCREEN_LOCK_ENABLED=false) */}
      {false &&
        page === "home" &&
        screenLock.locked &&
        createPortal(
          <ScreenLockGate
            onUnlock={async (password) => screenLock.unlock(password)}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {bookEntries &&
        createPortal(
          <DiaryBookViewer
            entries={bookEntries}
            rangeStart={bookRange?.start}
            rangeEnd={bookRange?.end}
            avatarUrl={avatarUrl}
            canDownloadPdf={accessStatus.canUseSearchAndExport}
            onRequirePremium={() => setSubscriptionModal("export")}
            onClose={() => {
              setBookEntries(null);
              setBookRange(null);
            }}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {subscriptionModal &&
        createPortal(
          <AppModal
            title={
              subscriptionModal === "write"
                ? t("subscription.limitTitle")
                : t("subscription.featureGateTitle")
            }
            lead={
              subscriptionModal === "search" || subscriptionModal === "export"
                ? t("subscription.featureGateLead")
                : subscriptionModal === "write" && !accessStatus.isPremiumActive
                  ? t("write.err.diaryDailyLimit")
                  : accessStatus.isPremiumActive
                    ? t("subscription.limitPremiumReachedLead")
                    : t("subscription.limitFreeLead")
            }
            onDismiss={closeSubscriptionModal}
            showClose
            primaryLabel={
              isFlutterApp()
                ? t("write.ai.goPurchase")
                : t("subscription.appOnly")
            }
            onPrimary={() => {
              closeSubscriptionModal();
              if (!isFlutterApp()) return;
              setNyangTicketTab("subscribe");
              setNyangTicketOpen(true);
            }}
            closeAriaLabel={t("common.close")}
          >
            <div className="subscription-modal__body">
              <SubscriptionBenefitsSwipe />
            </div>
          </AppModal>,
          document.getElementById("root") ?? document.body,
        )}
      {googleLoginForProOpen &&
        createPortal(
          <AppModal
            title={t("subscription.googleLoginRequiredTitle")}
            onDismiss={() => {
              clearPendingNyangPurchase();
              setGoogleLoginForProOpen(false);
            }}
            showClose
            primaryLabel={t("subscription.googleLoginRequiredCta")}
            onPrimary={() => {
              setGoogleLoginForProOpen(false);
              setAccountOpen(true);
            }}
            closeAriaLabel={t("common.close")}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {pagebyAfterSavePromptOpen &&
        createPortal(
          <AppModal
            title={t("rooms.afterSavePromptTitle")}
            lead={t("rooms.afterSavePromptLead")}
            onDismiss={() => {
              markPagebyAfterSavePromptSeen();
              setPagebyAfterSavePromptOpen(false);
            }}
            showClose
            primaryLabel={t("rooms.afterSavePromptOk")}
            onPrimary={() => {
              markPagebyAfterSavePromptSeen();
              setPagebyAfterSavePromptOpen(false);
              openRooms();
            }}
            secondaryLabel={t("rooms.afterSavePromptLater")}
            onSecondary={() => {
              markPagebyAfterSavePromptSeen();
              setPagebyAfterSavePromptOpen(false);
            }}
            closeAriaLabel={t("common.close")}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {appToast &&
        createPortal(
          <div className="app-toast" role="status">
            {appToast}
          </div>,
          document.getElementById("root") ?? document.body,
        )}
    </div>
  );
}

export default App;
