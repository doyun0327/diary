import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Header from './components/Header';
import WriteFab from './components/WriteFab';
import CharacterSetup from './components/CharacterSetup';
import AccountSheet from './components/AccountSheet';
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
import type { DiaryEntry } from './types/diary';
import './App.css';

export type Page = 'home' | 'write' | 'detail' | 'rooms' | 'room' | 'room-post';

function App() {
  const { entries, addEntry, updateEntry, removeEntry } = useDiary();
  const { character, setCharacter } = useCharacter();
  const { clientId, nickname, setNickname, avatarUrl, setAvatarUrl } = useClientProfile();
  const [page, setPage] = useState<Page>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [decorateOpen, setDecorateOpen] = useState(false);
  const [appInfoOpen, setAppInfoOpen] = useState(false);
  const [bookEntries, setBookEntries] = useState<DiaryEntry[] | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

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

  const openRooms = () => {
    setActiveRoomId(null);
    setActivePostId(null);
    setPage('rooms');
  };

  return (
    <div className="app">
      <Header
        nickname={nickname}
        avatarUrl={avatarUrl}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenDecorate={() => setDecorateOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenRooms={openRooms}
        onOpenAppInfo={() => setAppInfoOpen(true)}
      />
      <main>
        {page === 'home' && <DiaryListPage entries={entries} onSelect={handleSelect} />}
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
      {characterOpen && (
        <CharacterSetup
          character={character}
          onChange={setCharacter}
          onClose={() => setCharacterOpen(false)}
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
    </div>
  );
}

export default App;
