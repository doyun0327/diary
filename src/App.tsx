import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Header from './components/Header';
import WriteFab from './components/WriteFab';
import CharacterSetup from './components/CharacterSetup';
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
import { isCharacterSetupDone } from './utils/onboarding';
import type { DiaryEntry } from './types/diary';
import './App.css';

export type Page = 'home' | 'write' | 'detail' | 'rooms' | 'room' | 'room-post';

function App() {
  const { t } = useTranslation();
  const { entries, addEntry, updateEntry, removeEntry } = useDiary();
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
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  useEffect(() => {
    applyStoredFont();
  }, []);

  const selectedEntry = entries.find((e) => e.id === selectedId);
  const editingEntry = editingId
    ? entries.find((e) => e.id === editingId)
    : undefined;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
    setPage('detail');
  };

  const handleSave: Parameters<typeof DiaryWritePage>[0]['onSave'] = (entry) => {
    if (editingId) {
      updateEntry(editingId, entry);
      setSelectedId(editingId);
      setEditingId(null);
      setPage('detail');
      return;
    }

    addEntry(entry);
    setPage('home');
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

  return (
    <div className="app">
      <Header
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
            onDelete={removeEntry}
          />
        )}
        {page === 'rooms' && (
          <RoomsHubPage
            nickname={nickname}
            avatarUrl={avatarUrl}
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
            clientId={clientId}
            myAvatarUrl={avatarUrl}
            onBack={() => {
              setActivePostId(null);
              setPage('rooms');
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
            clientId={clientId}
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
            onNicknameChange={setNickname}
            onAvatarChange={setAvatarUrl}
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
          onOpenBook={(filtered) => {
            setExportOpen(false);
            setBookEntries(filtered);
          }}
        />
      )}
      {decorateOpen && <DecorateSheet onClose={() => setDecorateOpen(false)} />}
      {appInfoOpen && <AppInfoSheet onClose={() => setAppInfoOpen(false)} />}
      {bookEntries && (
        <DiaryBookViewer entries={bookEntries} onClose={() => setBookEntries(null)} />
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
