import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Header from './components/Header';
import WriteFab from './components/WriteFab';
import CharacterSetup from './components/CharacterSetup';
import ProfileSetup from './components/ProfileSetup';
import AppIntro from './components/AppIntro';
import AccountSheet from './components/AccountSheet';
import LanguageSheet from './components/LanguageSheet';
import ScreenLockGate from './components/ScreenLockGate';
import PinSetupScreen from './components/PinSetupScreen';
import PinVerifyScreen from './components/PinVerifyScreen';
import ExportSheet from './components/ExportSheet';
import DecorateSheet from './components/DecorateSheet';
import AppInfoSheet from './components/AppInfoSheet';
import { applyStoredFont } from './components/FontPicker';
import DiaryBookViewer from './components/DiaryBookViewer';
import DiaryListPage from './pages/DiaryListPage';
import DiaryWritePage from './pages/DiaryWritePage';
import DiaryDetailPage from './pages/DiaryDetailPage';
import RoomsHubPage from './pages/RoomsHubPage';
import RoomPage from './pages/RoomPage';
import RoomPostPage from './pages/RoomPostPage';
import { useDiary } from './hooks/useDiary';
import { useCharacter } from './hooks/useCharacter';
import { useClientProfile } from './hooks/useClientProfile';
import { useScreenLock } from './hooks/useScreenLock';
import { getAccessToken, useAuthSession } from './hooks/useAuthSession';
import { usePushOpenHandler, usePushRegistration } from './hooks/usePushRegistration';
import {
  isAppIntroDone,
  isCharacterSetupDone,
  isProfileSetupDone,
  markAppIntroDone,
  markProfileSetupDone,
} from './utils/onboarding';
import type { DiaryEntry } from './types/diary';
import { formatYearMonth } from './utils/date';
import { isFlutterApp, postDiaryNative } from './utils/nativeShare';
import './App.css';

export type Page = 'home' | 'write' | 'detail' | 'rooms' | 'room' | 'room-post';

function App() {
  const { t } = useTranslation();
  const { entries, addEntry, updateEntry, removeEntry, syncWithCloud } = useDiary();
  const { session, markSynced, ensureGuestSession } = useAuthSession();
  const { character, setCharacter } = useCharacter();
  const { clientId, nickname, setNickname, avatarUrl, setAvatarUrl } = useClientProfile();
  const screenLock = useScreenLock();
  const [page, setPage] = useState<Page>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [writeAfterCharacter, setWriteAfterCharacter] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [lockSetupOpen, setLockSetupOpen] = useState(false);
  const [lockDisableOpen, setLockDisableOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [decorateOpen, setDecorateOpen] = useState(false);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [bookEntries, setBookEntries] = useState<DiaryEntry[] | null>(null);
  const [bookRange, setBookRange] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const [onboardingTick, setOnboardingTick] = useState(0);
  const needsProfileSetup = !isProfileSetupDone();
  const needsAppIntro = !needsProfileSetup && !isAppIntroDone();
  void onboardingTick;

  useEffect(() => {
    applyStoredFont();
  }, []);

  useEffect(() => {
    if (needsProfileSetup) return;
    if (getAccessToken()) return;
    const nick = nickname.trim() || t('common.anonymous');
    void ensureGuestSession(clientId, nick).catch((err) => {
      console.warn('[guest] auto session failed', err);
    });
  }, [needsProfileSetup, clientId, nickname, ensureGuestSession, t]);

  usePushRegistration(!needsProfileSetup);

  const openFromPush = useCallback(
    (payload: { type?: string; roomId: string; postId?: string }) => {
      setActiveRoomId(payload.roomId);
      if (payload.postId) {
        setActivePostId(payload.postId);
        setPage('room-post');
        return;
      }
      setActivePostId(null);
      setPage('room');
    },
    [],
  );
  usePushOpenHandler(openFromPush);

  const selectedEntry = entries.find((e) => e.id === selectedId);
  const editingEntry = editingId
    ? entries.find((e) => e.id === editingId)
    : undefined;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
    setPage('detail');
  };

  const syncInBackground = () => {
    if (!getAccessToken() || session?.provider !== 'google') return;
    void syncWithCloud(session?.lastSyncedAt ?? null)
      .then((result) => markSynced(result.serverTime))
      .catch((err) => {
        console.warn('[sync] background failed', err);
      });
  };

  const handleSave: Parameters<typeof DiaryWritePage>[0]['onSave'] = (entry) => {
    if (editingId) {
      updateEntry(editingId, entry);
      setSelectedId(editingId);
      setEditingId(null);
      setPage('detail');
      syncInBackground();
      return;
    }

    addEntry(entry);
    setPage('home');
    syncInBackground();
  };

  const handleDelete = (id: string) => {
    removeEntry(id);
    syncInBackground();
  };

  const handleEdit = () => {
    if (!selectedId) return;
    setEditingId(selectedId);
    setPage('write');
  };

  const handleWriteCancel = () => {
    if (editingId) {
      setEditingId(null);
      setPage('detail');
      return;
    }
    setPage('home');
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
    if (page === 'room-post') {
      setActivePostId(null);
      setPage('room');
      return true;
    }
    if (page === 'room') {
      setActivePostId(null);
      setPage('rooms');
      return true;
    }
    if (page === 'rooms') {
      setPage('home');
      return true;
    }
    if (page === 'detail') {
      setPage('home');
      return true;
    }
    if (page === 'write') {
      handleWriteCancel();
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
    window.addEventListener('diary-native-back', onNativeBack);
    return () => {
      delete window.diaryGoBack;
      window.removeEventListener('diary-native-back', onNativeBack);
    };
  }, []);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY);
      if (el?.closest('[data-no-swipe], input, textarea, button, a, [contenteditable="true"]')) {
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
      if (e.pointerType === 'mouse' && e.button !== 0) return;
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
    window.addEventListener('pointerdown', onPointerStart, opts);
    window.addEventListener('pointerup', onPointerEnd, opts);
    window.addEventListener('pointercancel', onCancel, opts);
    window.addEventListener('touchstart', onTouchStart, opts);
    window.addEventListener('touchend', onTouchEnd, opts);
    window.addEventListener('touchcancel', onCancel, opts);
    return () => {
      window.removeEventListener('pointerdown', onPointerStart, opts);
      window.removeEventListener('pointerup', onPointerEnd, opts);
      window.removeEventListener('pointercancel', onCancel, opts);
      window.removeEventListener('touchstart', onTouchStart, opts);
      window.removeEventListener('touchend', onTouchEnd, opts);
      window.removeEventListener('touchcancel', onCancel, opts);
    };
  }, []);

  const handleNewWrite = () => {
    setEditingId(null);
    setPage('write');
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
    setPage('rooms');
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
    if (!isFlutterApp()) return;
    postDiaryNative({
      type: 'headerState',
      visible: !needsProfileSetup && !needsAppIntro,
      showCalendar: page === 'home',
      year: calYear,
      month: calMonth,
      label: formatYearMonth(calYear, calMonth),
    });
  }, [page, calYear, calMonth, needsProfileSetup, needsAppIntro]);

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
              console.warn('[guest] session after profile setup failed', err);
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
            setPage('home');
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {/* 웹 상단 헤더는 주석 처리. Flutter AppBar + hideBar로 메뉴만 유지 */}
      <Header
        hideBar
        nickname={nickname}
        avatarUrl={avatarUrl}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenLanguage={() => setLanguageOpen(true)}
        screenLockEnabled={screenLock.enabled}
        onToggleScreenLock={handleToggleScreenLock}
        onOpenDecorate={() => setDecorateOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenRooms={openRooms}
        onOpenAppInfo={() => setAppInfoOpen(true)}
        calendarNav={
          page === 'home'
            ? {
                year: calYear,
                month: calMonth,
                onPrev: () => moveCalendarMonth(-1),
                onNext: () => moveCalendarMonth(1),
                onSelectMonth: (year, month) => {
                  setCalYear(year);
                  setCalMonth(month);
                },
              }
            : null
        }
      />
      <main>
        {page === 'home' && (
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
        {page === 'write' && (
          <DiaryWritePage
            key={editingId ?? 'new'}
            character={character}
            initialEntry={editingEntry}
            onSave={handleSave}
            onCancel={handleWriteCancel}
            onOpenCharacter={() => setCharacterOpen(true)}
          />
        )}
        {page === 'detail' && selectedEntry && (
          <DiaryDetailPage
            entry={selectedEntry}
            onBack={() => setPage('home')}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onOpenRooms={() => {
              setActiveRoomId(null);
              setActivePostId(null);
              setPage('rooms');
            }}
          />
        )}
        {page === 'rooms' && (
          <RoomsHubPage
            nickname={nickname}
            avatarUrl={avatarUrl}
            clientId={clientId}
            ensureGuestSession={ensureGuestSession}
            onOpenAccount={() => setAccountOpen(true)}
            onBack={() => setPage('home')}
            onOpenRoom={(roomId) => {
              setActiveRoomId(roomId);
              setActivePostId(null);
              setPage('room');
            }}
          />
        )}
        {page === 'room' && activeRoomId && (
          <RoomPage
            roomId={activeRoomId}
            onBack={() => {
              setActivePostId(null);
              setPage('rooms');
            }}
            onGoHome={() => {
              setActiveRoomId(null);
              setActivePostId(null);
              setPage('home');
            }}
            onOpenPost={(postId) => {
              setActivePostId(postId);
              setPage('room-post');
            }}
          />
        )}
        {page === 'room-post' && activeRoomId && activePostId && (
          <RoomPostPage
            roomId={activeRoomId}
            postId={activePostId}
            userId={session?.userId ?? ''}
            onBack={() => {
              setActivePostId(null);
              setPage('room');
            }}
          />
        )}
      </main>
      {page === 'home' && <WriteFab onClick={handleNewWrite} />}
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
          document.getElementById('root') ?? document.body,
        )}
      {languageOpen &&
        createPortal(
          <LanguageSheet onClose={() => setLanguageOpen(false)} />,
          document.getElementById('root') ?? document.body,
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
          document.getElementById('root') ?? document.body,
        )}
      {lockDisableOpen &&
        createPortal(
          <PinVerifyScreen
            title={t('lock.disableTitle')}
            hint={t('lock.disableHint')}
            onVerified={async (pin) => {
              const ok = await screenLock.disableLock(pin);
              if (ok) setLockDisableOpen(false);
              return ok;
            }}
            onCancel={() => setLockDisableOpen(false)}
          />,
          document.getElementById('root') ?? document.body,
        )}
      {characterOpen && (
        <CharacterSetup
          character={character}
          onChange={setCharacter}
          onClose={() => {
            setCharacterOpen(false);
            if (writeAfterCharacter) {
              setWriteAfterCharacter(false);
            }
          }}
          onComplete={() => {
            if (writeAfterCharacter) {
              setWriteAfterCharacter(false);
              handleNewWrite();
            }
          }}
        />
      )}
      {exportOpen && (
        <ExportSheet
          entries={entries}
          onClose={() => setExportOpen(false)}
          onOpenBook={(filtered, range) => {
            setExportOpen(false);
            setBookEntries(filtered);
            setBookRange(range);
          }}
        />
      )}
      {decorateOpen && <DecorateSheet onClose={() => setDecorateOpen(false)} />}
      {appInfoOpen && <AppInfoSheet onClose={() => setAppInfoOpen(false)} />}
      {bookEntries && (
        <DiaryBookViewer
          entries={bookEntries}
          rangeStart={bookRange?.start}
          rangeEnd={bookRange?.end}
          avatarUrl={avatarUrl}
          onClose={() => {
            setBookEntries(null);
            setBookRange(null);
          }}
        />
      )}
      {screenLock.locked &&
        createPortal(
          <ScreenLockGate onUnlock={screenLock.unlock} />,
          document.getElementById('root') ?? document.body,
        )}
    </div>
  );
}

export default App;
