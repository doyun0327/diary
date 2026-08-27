import { useCallback, useState } from 'react';
import type { DiaryEntry } from '../types/diary';
import { createId } from '../utils/id';
import { getStoredMoodPackId, parseMoodPackId } from '../utils/moodPack';

const STORAGE_KEY = 'picture-diary-entries';
const DELETED_KEY = 'picture-diary-deleted-ids';

function stampMissingMoodPack(entries: DiaryEntry[]): DiaryEntry[] {
  const fallback = getStoredMoodPackId();
  let changed = false;
  const next = entries.map((entry) => {
    const pack = parseMoodPackId(entry.moodPack);
    if (pack && pack === entry.moodPack) return entry;
    changed = true;
    return { ...entry, moodPack: pack ?? fallback };
  });
  if (changed) persistEntries(next);
  return next;
}

function loadEntries(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as DiaryEntry[]) : [];
    return stampMissingMoodPack(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function persistEntries(entries: DiaryEntry[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    console.error('[diary] localStorage persist failed', err);
    return false;
  }
}

function loadDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persistDeletedIds(ids: string[]) {
  try {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // ignore
  }
}

/** 일기 목록을 localStorage에 저장/관리 (클라우드 sync 비활성) */
export function useDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>(loadEntries);
  const [, setDeletedIds] = useState<string[]>(loadDeletedIds);

  const addEntry = useCallback(
    (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newEntry: DiaryEntry = {
        ...entry,
        id: createId(),
        createdAt: now,
        updatedAt: now,
      };
      setEntries((prev) => {
        const next = [newEntry, ...prev];
        persistEntries(next);
        return next;
      });
      setDeletedIds((prev) => {
        const next = prev.filter((id) => id !== newEntry.id);
        persistDeletedIds(next);
        return next;
      });
      return newEntry;
    },
    [],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<Omit<DiaryEntry, 'id' | 'createdAt'>>) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id
            ? { ...e, ...patch, updatedAt: new Date().toISOString() }
            : e,
        );
        persistEntries(next);
        return next;
      });
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persistEntries(next);
      return next;
    });
    setDeletedIds((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      persistDeletedIds(next);
      return next;
    });
  }, []);

  const replaceEntries = useCallback((next: DiaryEntry[]) => {
    persistEntries(next);
    setEntries(next);
  }, []);

  const clearLocalDiaries = useCallback(() => {
    persistEntries([]);
    persistDeletedIds([]);
    setEntries([]);
    setDeletedIds([]);
  }, []);

  return {
    entries,
    addEntry,
    updateEntry,
    removeEntry,
    replaceEntries,
    clearLocalDiaries,
  };
}
