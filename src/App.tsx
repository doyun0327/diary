import { useState } from 'react';
import Header from './components/Header';
import WriteFab from './components/WriteFab';
import DiaryListPage from './pages/DiaryListPage';
import DiaryWritePage from './pages/DiaryWritePage';
import DiaryDetailPage from './pages/DiaryDetailPage';
import { useDiary } from './hooks/useDiary';
import './App.css';

export type Page = 'home' | 'write' | 'detail';

function App() {
  const { entries, addEntry, removeEntry } = useDiary();
  const [page, setPage] = useState<Page>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEntry = entries.find((e) => e.id === selectedId);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setPage('detail');
  };

  const handleSave: Parameters<typeof DiaryWritePage>[0]['onSave'] = (entry) => {
    addEntry(entry);
    setPage('home');
  };

  return (
    <div className="app">
      <Header />
      <main>
        {page === 'home' && <DiaryListPage entries={entries} onSelect={handleSelect} />}
        {page === 'write' && (
          <DiaryWritePage onSave={handleSave} onCancel={() => setPage('home')} />
        )}
        {page === 'detail' && selectedEntry && (
          <DiaryDetailPage
            entry={selectedEntry}
            onBack={() => setPage('home')}
            onDelete={removeEntry}
          />
        )}
      </main>
      {page === 'home' && <WriteFab onClick={() => setPage('write')} />}
    </div>
  );
}

export default App;
