import { useCallback, useEffect, useState } from 'react';
import type { DiaryEntry } from '../types/diary';
import { createId } from '../utils/id';
import { getStoredMoodPackId, parseMoodPackId } from '../utils/moodPack';
import {
  clearDiaryImages,
  deleteDiaryImage,
  getDiaryImage,
  isEmbeddedDataUrl,
  putDiaryImage,
} from '../utils/diaryImageStore';

const STORAGE_KEY = 'picture-diary-entries';
const DELETED_KEY = 'picture-diary-deleted-ids';

/** localStorage에는 data URL을 넣지 않음 (용량 초과로 그림 유실 방지) */
function toStorageEntry(entry: DiaryEntry): DiaryEntry {
  if (!isEmbeddedDataUrl(entry.imageUrl)) return entry;
  const { imageUrl: _omit, ...rest } = entry;
  return rest;
}

function persistEntries(entries: DiaryEntry[]): boolean {
  try {
    const payload = entries.map(toStorageEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('[diary] localStorage persist failed', err);
    return false;
  }
}

function loadEntriesRaw(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as DiaryEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

/** LS의 data URL → IndexedDB 이관 + IDB에서 그림 복원 */
async function hydrateEntries(entries: DiaryEntry[]): Promise<DiaryEntry[]> {
  let migrated = false;
  const next: DiaryEntry[] = [];

  for (const entry of entries) {
    if (isEmbeddedDataUrl(entry.imageUrl)) {
      try {
        await putDiaryImage(entry.id, entry.imageUrl!);
        migrated = true;
      } catch (err) {
        console.error('[diary] migrate image failed', entry.id, err);
      }
      next.push(entry);
      continue;
    }

    try {
      const fromIdb = await getDiaryImage(entry.id);
      next.push(fromIdb ? { ...entry, imageUrl: fromIdb } : entry);
    } catch (err) {
      console.error('[diary] load image failed', entry.id, err);
      next.push(entry);
    }
  }

  if (migrated) {
    persistEntries(next);
  }
  return next;
}

async function persistEntryImage(entryId: string, imageUrl: string | undefined) {
  if (isEmbeddedDataUrl(imageUrl)) {
    await putDiaryImage(entryId, imageUrl!);
    return;
  }
  if (!imageUrl) {
    await deleteDiaryImage(entryId);
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

/** 일기 목록: 메타는 localStorage, https 그림은 URL만 저장 / data URL은 IndexedDB 폴백 */
export function useDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>(() =>
    stampMissingMoodPack(loadEntriesRaw()),
  );
  const [, setDeletedIds] = useState<string[]>(loadDeletedIds);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = stampMissingMoodPack(loadEntriesRaw());
        const hydrated = await hydrateEntries(raw);
        if (!cancelled) setEntries(hydrated);
      } catch (err) {
        console.error('[diary] hydrate failed', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addEntry = useCallback(
    async (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newEntry: DiaryEntry = {
        ...entry,
        id: createId(),
        createdAt: now,
        updatedAt: now,
      };
      try {
        await persistEntryImage(newEntry.id, newEntry.imageUrl);
      } catch (err) {
        console.error('[diary] save image failed', err);
        throw err instanceof Error ? err : new Error('그림 저장에 실패했어요');
      }
      setEntries((prev) => {
        const next = [newEntry, ...prev];
        if (!persistEntries(next)) {
          console.error('[diary] meta persist failed after add');
        }
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
    async (id: string, patch: Partial<Omit<DiaryEntry, 'id' | 'createdAt'>>) => {
      if ('imageUrl' in patch) {
        try {
          await persistEntryImage(id, patch.imageUrl);
        } catch (err) {
          console.error('[diary] update image failed', err);
          throw err instanceof Error ? err : new Error('그림 저장에 실패했어요');
        }
      }
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id
            ? { ...e, ...patch, updatedAt: new Date().toISOString() }
            : e,
        );
        if (!persistEntries(next)) {
          console.error('[diary] meta persist failed after update');
        }
        return next;
      });
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    void deleteDiaryImage(id);
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
    void clearDiaryImages();
    persistEntries([]);
    persistDeletedIds([]);
    setEntries([]);
    setDeletedIds([]);
  }, []);

  return {
    entries,
    ready,
    addEntry,
    updateEntry,
    removeEntry,
    replaceEntries,
    clearLocalDiaries,
  };
}
