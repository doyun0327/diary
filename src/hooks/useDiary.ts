import { useCallback, useEffect, useState } from 'react';
import type { DiaryEntry } from '../types/diary';

const STORAGE_KEY = 'picture-diary-entries';

function loadEntries(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DiaryEntry[]) : [];
  } catch {
    return [];
  }
}

/** 일기 목록을 localStorage에 저장/관리하는 훅 */
export function useDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>(loadEntries);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const addEntry = useCallback(
    (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newEntry: DiaryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => [newEntry, ...prev]);
      return newEntry;
    },
    [],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<DiaryEntry, 'id' | 'createdAt'>>) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, ...patch, updatedAt: new Date().toISOString() }
            : e,
        ),
      );
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, addEntry, updateEntry, removeEntry };
}
