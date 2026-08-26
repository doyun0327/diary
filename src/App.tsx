import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Header from "./components/Header";
import WriteFab from "./components/WriteFab";
import CharacterSetup from "./components/CharacterSetup";
import ProfileSetup from "./components/ProfileSetup";
import AppIntro from "./components/AppIntro";
import AccountSheet from "./components/AccountSheet";
import LanguageSheet from "./components/LanguageSheet";
import ScreenLockGate from "./components/ScreenLockGate";
import PinSetupScreen from "./components/PinSetupScreen";
import PinVerifyScreen from "./components/PinVerifyScreen";
import ExportSheet from "./components/ExportSheet";
import DecorateSheet from "./components/DecorateSheet";
import AppInfoSheet from "./components/AppInfoSheet";
import SearchSheet from "./components/SearchSheet";
import AppModal from "./components/AppModal";
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
import { useCharacter } from "./hooks/useCharacter";
import { useClientProfile } from "./hooks/useClientProfile";
import { useScreenLock } from "./hooks/useScreenLock";
import { getAccessToken, useAuthSession } from "./hooks/useAuthSession";
import {
  usePushOpenHandler,
  usePushRegistration,
} from "./hooks/usePushRegistration";
import {
  isAppIntroDone,
  isCharacterSetupDone,
  isProfileSetupDone,
  markAppIntroDone,
  markProfileSetupDone,
} from "./utils/onboarding";
import type { DiaryEntry } from "./types/diary";
import { formatYearMonth } from "./utils/date";
import { isFlutterApp, postDiaryNative } from "./utils/nativeShare";
import { clearWriteDraft } from "./utils/writeDraft";
import { syncSharedDiaryAfterEdit } from "./utils/syncSharedDiary";
import {
  applyMonthlyUsageFromServer,
  consumeDiaryUsage,
  getDiaryAccessState,
  setDiaryAccessAccountId,
  subscribeDiaryAccess,
  SUBSCRIPTION_CHANGE_EVENT,
} from "./utils/diaryAccess";
import {
  consumeMonthlyUsage,
  fetchMonthlyUsage,
} from "./api/usageApi";
import {
  identifySubscriptionUser,
  installSubscriptionBridge,
  requestSubscriptionPurchase,
  syncSubscriptionFromNative,
} from "./utils/subscription";
import "./App.css";

export type Page = "home" | "write" | "detail" | "rooms" | "room" | "room-post";

type SubscriptionModalReason = "write" | "search" | "export";

function App() {
  const { t } = useTranslation();
  const { entries, addEntry, updateEntry, removeEntry, syncWithCloud } =
    useDiary();
  const { session, markSynced, ensureGuestSession } = useAuthSession();
  const { character, setCharacter } = useCharacter();
  const { clientId, nickname, setNickname, avatarUrl, setAvatarUrl } =
    useClientProfile();
  const screenLock = useScreenLock();
  const [page, setPage] = useState<Page>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [writeAfterCharacter, setWriteAfterCharacter] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
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
  const [subscriptionModal, setSubscriptionModal] =
    useState<SubscriptionModalReason | null>(null);
  const [writeSaveEnabled, setWriteSaveEnabled] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [accessTick, setAccessTick] = useState(0);
  void accessTick;

  const accessStatus = getDiaryAccessState(entries.length);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const [onboardingTick, setOnboardingTick] = useState(0);
  const needsProfileSetup = !isProfileSetupDone();
  const needsAppIntro = !needsProfileSetup && !isAppIntroDone();
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
    setDiaryAccessAccountId(session?.userId ?? clientId);
  }, [session?.userId, clientId]);

  useEffect(() => {
    if (!isFlutterApp()) return;
    const userId = session?.userId ?? clientId;
    if (userId) identifySubscriptionUser(userId);
    // 계정 전환·로그인 직후 Pro 상태 다시 받아 AI 광고 스킵되게
    syncSubscriptionFromNative();
  }, [session?.userId, clientId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !getDiaryAccessState(entries.length).isPremiumActive) return;
    void fetchMonthlyUsage(token)
      .then((usage) =>
        applyMonthlyUsageFromServer(usage.used, usage.yearMonth),
      )
      .catch(() => {
        // 백엔드 미적용 시 로컬 카운트 유지
      });
  }, [session?.userId, entries.length, accessTick]);

  const closeSubscriptionModal = useCallback(() => {
    setSubscriptionModal(null);
    setSubscribing(false);
  }, []);

  const openPremiumFeature = useCallback(
    (reason: "search" | "export", open: () => void) => {
      if (accessStatus.canUseSearchAndExport) {
        open();
        return;
      }
      setSubscriptionModal(reason);
    },
    [accessStatus.canUseSearchAndExport],
  );

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
        if (reason === "search") setSearchOpen(true);
        if (reason === "export") setExportOpen(true);
      }
    };
    window.addEventListener(SUBSCRIPTION_CHANGE_EVENT, onSubscriptionChange);
    return () =>
      window.removeEventListener(SUBSCRIPTION_CHANGE_EVENT, onSubscriptionChange);
  }, [subscriptionModal, entries.length, closeSubscriptionModal]);

  useEffect(() => {
    if (needsProfileSetup) return;
    if (getAccessToken()) return;
    const nick = nickname.trim() || t("common.anonymous");
    void ensureGuestSession(clientId, nick).catch((err) => {
      console.warn("[guest] auto session failed", err);
    });
  }, [needsProfileSetup, clientId, nickname, ensureGuestSession, t]);

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

  const handleSelect = (id: string) => {
    setSearchOpen(false);
    setSelectedId(id);
    setEditingId(null);
    setPage("detail");
  };

  const syncInBackground = () => {
    if (!getAccessToken() || session?.provider !== "google") return;
    void syncWithCloud(session?.lastSyncedAt ?? null)
      .then((result) => markSynced(result.serverTime))
      .catch((err) => {
        console.warn("[sync] background failed", err);
      });
  };

  const handleSave: Parameters<typeof DiaryWritePage>[0]["onSave"] = (
    entry,
  ) => {
    if (editingId) {
      const id = editingId;
      updateEntry(id, entry);
      setSelectedId(id);
      setEditingId(null);
      setPage("detail");
      void syncSharedDiaryAfterEdit(id, entry);
      syncInBackground();
      return;
    }

    const status = getDiaryAccessState(entries.length);
    // 프리미엄 월 한도만 저장 차단. 무료는 일기 저장 무제한.
    if (status.isPremiumActive && !status.canCreate) {
      setSubscriptionModal("write");
      return;
    }

    if (status.isPremiumActive) {
      const token = getAccessToken();
      if (token) {
        void consumeMonthlyUsage(token)
          .then((usage) => {
            applyMonthlyUsageFromServer(usage.used, usage.yearMonth);
            addEntry(entry);
            setPage("home");
            syncInBackground();
          })
          .catch(async (err) => {
            const message =
              err instanceof Error ? err.message : String(err);
            if (message.includes("409")) {
              try {
                const usage = await fetchMonthlyUsage(token);
                applyMonthlyUsageFromServer(usage.used, usage.yearMonth);
              } catch {
                // ignore
              }
              setSubscriptionModal("write");
              return;
            }
            consumeDiaryUsage();
            addEntry(entry);
            setPage("home");
            syncInBackground();
          });
        return;
      }
      consumeDiaryUsage();
    }

    addEntry(entry);
    setPage("home");
    syncInBackground();
  };

  const handleDelete = (id: string) => {
    removeEntry(id);
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
      setWriteAfterCharacter(false);
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
    appInfoOpen,
    bookEntries,
    characterOpen,
    decorateOpen,
    editingId,
    exportOpen,
    searchOpen,
    languageOpen,
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

  const openWritePage = () => {
    setEditingId(null);
    clearWriteDraft();
    setPage("write");
  };

  const handleNewWrite = () => {
    const status = getDiaryAccessState(entries.length);
    // 프리미엄 월 한도만 작성 진입에서 막음. 무료 한도 소진 후에도 그림 일기는 열 수 있음.
    if (status.isPremiumActive && !status.canCreate) {
      setSubscriptionModal("write");
      return;
    }
    openWritePage();
  };

  const handleStartFirstDiary = () => {
    if (isCharacterSetupDone()) {
      handleNewWrite();
      return;
    }
    setWriteAfterCharacter(true);
    setCharacterOpen(true);
  };

  const openRooms = () => {
    setActiveRoomId(null);
    setActivePostId(null);
    setPage("rooms");
  };

  const handleToggleScreenLock = () => {
    if (screenLock.enabled) {
      setLockDisableOpen(true);
      return;
    }
    if (screenLock.hasPin) {
      screenLock.turnOn();
      return;
    }
    setLockSetupOpen(true);
  };

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
        !needsProfileSetup && !needsAppIntro && !hideNativeChrome;

      // 채널만 있으면 전송 (isFlutterApp 게이트 제거 — 플래그 미설정 시에도 숨김 반영)
      postDiaryNative({
        type: "headerState",
        visible,
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
            : isWrite
              ? editingId
                ? t("write.title.edit")
                : t("write.title.new")
              : "",
        saveLabel: editingId ? t("write.saveEdit") : t("write.save"),
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
    needsAppIntro,
    editingId,
    writeSaveEnabled,
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
          onComplete={({ nickname: nextName, avatarUrl: nextAvatar }) => {
            setNickname(nextName);
            setAvatarUrl(nextAvatar);
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

  if (needsAppIntro) {
    return (
      <div className="app">
        <AppIntro
          onFinish={() => {
            markAppIntroDone();
            setOnboardingTick((n) => n + 1);
            setPage("home");
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
        screenLockEnabled={screenLock.enabled}
        onToggleScreenLock={handleToggleScreenLock}
        onOpenDecorate={() => setDecorateOpen(true)}
        onOpenExport={() =>
          openPremiumFeature("export", () => setExportOpen(true))
        }
        onOpenSearch={() =>
          openPremiumFeature("search", () => setSearchOpen(true))
        }
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
      <main>
        {page === "home" && (
          <DiaryListPage
            entries={entries}
            onSelect={handleSelect}
            viewYear={calYear}
            viewMonth={calMonth}
            onViewChange={(year, month) => {
              setCalYear(year);
              setCalMonth(month);
            }}
            onStartFirstDiary={handleStartFirstDiary}
          />
        )}
        {page === "write" && (
          <DiaryWritePage
            key={editingId ?? "new"}
            character={character}
            initialEntry={editingEntry}
            entriesCount={entries.length}
            onSave={handleSave}
            onCancel={handleWriteCancel}
            onOpenCharacter={() => setCharacterOpen(true)}
            onOpenWriteLimitModal={() => setSubscriptionModal("write")}
            onNativeSaveStateChange={setWriteSaveEnabled}
            writeQuota={
              accessStatus.isPremiumActive
                ? {
                    used: accessStatus.monthlyUsed,
                    limit: accessStatus.monthlyLimit,
                  }
                : undefined
            }
          />
        )}
        {page === "detail" && selectedEntry && (
          <DiaryDetailPage
            entry={selectedEntry}
            onBack={() => setPage("home")}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onOpenRooms={() => {
              setActiveRoomId(null);
              setActivePostId(null);
              setPage("rooms");
            }}
          />
        )}
        {page === "rooms" && (
          <RoomsHubPage
            nickname={nickname}
            avatarUrl={avatarUrl}
            clientId={clientId}
            ensureGuestSession={ensureGuestSession}
            onOpenAccount={() => setAccountOpen(true)}
            onBack={() => setPage("home")}
            onOpenRoom={(roomId) => {
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
            onBack={() => {
              setActivePostId(null);
              setPage("rooms");
            }}
            onGoHome={() => {
              setActiveRoomId(null);
              setActivePostId(null);
              setPage("home");
            }}
            onOpenPost={(postId) => {
              setActivePostId(postId);
              setPage("room-post");
            }}
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
      {page === "home" && <WriteFab onClick={handleNewWrite} />}
      {accountOpen &&
        createPortal(
          <AccountSheet
            nickname={nickname}
            avatarUrl={avatarUrl}
            clientId={clientId}
            onNicknameChange={setNickname}
            onAvatarChange={setAvatarUrl}
            onSyncDiaries={syncWithCloud}
            onClose={() => setAccountOpen(false)}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {languageOpen &&
        createPortal(
          <LanguageSheet onClose={() => setLanguageOpen(false)} />,
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
            onSelect={handleSelect}
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
              setWriteAfterCharacter(false);
            }}
            onComplete={() => {
              setCharacterOpen(false);
              if (writeAfterCharacter) {
                setWriteAfterCharacter(false);
                handleNewWrite();
              }
            }}
          />,
          document.getElementById("root") ?? document.body,
        )}
      {page === "home" &&
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
                : accessStatus.isPremiumActive
                  ? t("subscription.limitPremiumReachedLead")
                  : t("subscription.limitFreeLead")
            }
            onDismiss={closeSubscriptionModal}
            showClose={false}
            secondaryLabel={t("common.cancel")}
            onSecondary={closeSubscriptionModal}
            primaryLabel={
              subscribing
                ? t("common.processing")
                : isFlutterApp()
                  ? t("subscription.subscribeCta")
                  : t("subscription.appOnly")
            }
            onPrimary={() => {
              if (!isFlutterApp()) return;
              if (subscribing) return;
              setSubscribing(true);
              requestSubscriptionPurchase();
            }}
            closeAriaLabel={t("common.close")}
          >
            <div className="subscription-modal__body">
              <SubscriptionBenefitsSwipe />
            </div>
          </AppModal>,
          document.getElementById("root") ?? document.body,
        )}
    </div>
  );
}

export default App;
