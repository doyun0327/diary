import { useCallback, useEffect, useState } from 'react';
import { syncDiaries } from '../api/diariesApi';
import { getAccessToken } from './useAuthSession';
import type { DiaryCanvasState, DiaryEntry } from '../types/diary';
import { mergeDiaryEntries } from '../utils/diarySync';
import { createId } from '../utils/id';
import { getStoredMoodPackId, parseMoodPackId } from '../utils/moodPack';
import { resolveDiaryImageForSave } from '../utils/resolveDiaryImage';
import {
  clearDiaryImages,
  deleteDiaryCanvasJson,
  deleteDiaryImage,
  getDiaryCanvasJson,
  getDiaryImage,
  isEmbeddedDataUrl,
  putDiaryCanvasJson,
  putDiaryImage,
} from '../utils/diaryImageStore';

const STORAGE_KEY = 'picture-diary-entries';
const DELETED_KEY = 'picture-diary-deleted-ids';

function canvasStateHasDataUrl(state: DiaryCanvasState | undefined): boolean {
  if (!state) return false;
  if (isEmbeddedDataUrl(state.inkUrl)) return true;
  return (state.photos ?? []).some((p) => isEmbeddedDataUrl(p.src));
}

function canvasLayerCount(state: DiaryCanvasState | undefined): number {
  if (!state) return 0;
  return (
    (state.photos?.length ?? 0) +
    (state.stickers?.length ?? 0) +
    (state.inkUrl ? 1 : 0)
  );
}

/** localStorage에는 canvasState data URL만 제외 (imageUrl은 친구방 공유를 위해 유지) */
function toStorageEntry(entry: DiaryEntry): DiaryEntry {
  let next: DiaryEntry = entry;
  if (next.canvasState && canvasStateHasDataUrl(next.canvasState)) {
    const { canvasState: _omit, ...rest } = next;
    next = rest;
  }
  return next;
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

function loadEntries(): DiaryEntry[] {
  return stampMissingMoodPack(loadEntriesRaw());
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

async function hydrateEntries(entries: DiaryEntry[]): Promise<DiaryEntry[]> {
  let migrated = false;
  const next: DiaryEntry[] = [];

  for (const entry of entries) {
    let current = entry;

    if (isEmbeddedDataUrl(current.imageUrl)) {
      try {
        await putDiaryImage(current.id, current.imageUrl!);
        migrated = true;
      } catch (err) {
        console.error('[diary] migrate image failed', current.id, err);
      }
    } else if (!current.imageUrl) {
      try {
        const fromIdb = await getDiaryImage(current.id);
        if (fromIdb) current = { ...current, imageUrl: fromIdb };
      } catch (err) {
        console.error('[diary] load image failed', current.id, err);
      }
    }

    if (current.canvasState && canvasStateHasDataUrl(current.canvasState)) {
      try {
        await putDiaryCanvasJson(current.id, JSON.stringify(current.canvasState));
        migrated = true;
      } catch (err) {
        console.error('[diary] migrate canvas failed', current.id, err);
      }
    }

    try {
      const raw = await getDiaryCanvasJson(current.id);
      if (raw) {
        const fromIdb = JSON.parse(raw) as DiaryCanvasState;
        const idbPhotos = fromIdb.photos?.length ?? 0;
        const curPhotos = current.canvasState?.photos?.length ?? 0;
        if (
          !current.canvasState ||
          canvasLayerCount(fromIdb) > canvasLayerCount(current.canvasState) ||
          idbPhotos > curPhotos
        ) {
          current = { ...current, canvasState: fromIdb };
        }
      }
    } catch (err) {
      console.error('[diary] load canvas failed', current.id, err);
    }

    next.push(current);
  }

  if (migrated) {
    persistEntries(next);
  }
  return next;
}

async function persistEntryMedia(
  entryId: string,
  imageUrl: string | undefined,
  canvasState: DiaryCanvasState | undefined,
) {
  if (isEmbeddedDataUrl(imageUrl)) {
    await putDiaryImage(entryId, imageUrl!);
  }

  if (!canvasState) {
    await deleteDiaryCanvasJson(entryId);
    return;
  }

  try {
    await putDiaryCanvasJson(entryId, JSON.stringify(canvasState));
  } catch (err) {
    console.warn('[diary] canvas full save failed, retry without ink', err);
    const slim: DiaryCanvasState = { ...canvasState, inkUrl: undefined };
    await putDiaryCanvasJson(entryId, JSON.stringify(slim));
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

/** sync 전송용: https 그림만 담고 canvasState는 제외 */
async function prepareEntriesForSync(
  entries: DiaryEntry[],
): Promise<DiaryEntry[]> {
  const prepared: DiaryEntry[] = [];
  for (const entry of entries) {
    let imageUrl = entry.imageUrl;
    if (!imageUrl || isEmbeddedDataUrl(imageUrl)) {
      try {
        const fromIdb = await getDiaryImage(entry.id);
        if (fromIdb?.startsWith('http://') || fromIdb?.startsWith('https://')) {
          imageUrl = fromIdb;
        } else if (isEmbeddedDataUrl(fromIdb)) {
          imageUrl = await resolveDiaryImageForSave(fromIdb);
        }
      } catch (err) {
        console.warn('[diary] sync image prepare failed', entry.id, err);
      }
    } else if (isEmbeddedDataUrl(imageUrl)) {
      imageUrl = await resolveDiaryImageForSave(imageUrl);
    }

    const { canvasState: _omit, ...rest } = entry;
    prepared.push({
      ...rest,
      imageUrl:
        imageUrl && !isEmbeddedDataUrl(imageUrl) ? imageUrl : undefined,
    });
  }
  return prepared;
}

/** 일기 목록: 메타는 localStorage, 그림·레이어는 IndexedDB/HTTPS + 클라우드 동기화 */
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
        await persistEntryMedia(
          newEntry.id,
          newEntry.imageUrl,
          newEntry.canvasState,
        );
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
      if ('imageUrl' in patch || 'canvasState' in patch) {
        try {
          await persistEntryMedia(id, patch.imageUrl, patch.canvasState);
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
    void deleteDiaryCanvasJson(id);
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

  /**
   * 서버와 LWW 동기화.
   * @param since 마지막 성공 동기화 시각 (없으면 전체 pull)
   */
  const syncWithCloud = useCallback(async (since: string | null) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('로그인이 필요해요');
    }

    const pendingDeletes = loadDeletedIds();
    const localEntries = await hydrateEntries(loadEntries());
    const entriesForSync = await prepareEntriesForSync(localEntries);

    // 업로드로 https가 생긴 항목은 로컬에도 반영
    for (const synced of entriesForSync) {
      if (!synced.imageUrl || isEmbeddedDataUrl(synced.imageUrl)) continue;
      const local = localEntries.find((e) => e.id === synced.id);
      if (local && local.imageUrl !== synced.imageUrl) {
        local.imageUrl = synced.imageUrl;
      }
    }

    const res = await syncDiaries(token, {
      since,
      entries: entriesForSync,
      deletedIds: pendingDeletes,
    });

    const merged = mergeDiaryEntries(localEntries, res.entries ?? [], [
      ...pendingDeletes,
      ...(res.deletedIds ?? []),
    ]);

    const hydrated = await hydrateEntries(merged);
    persistEntries(hydrated);
    setEntries(hydrated);

    const sentDeletes = new Set(pendingDeletes);
    setDeletedIds((prev) => {
      const next = prev.filter(
        (id) => !sentDeletes.has(id) && !hydrated.some((e) => e.id === id),
      );
      persistDeletedIds(next);
      return next;
    });

    return {
      serverTime: res.serverTime || new Date().toISOString(),
      entryCount: hydrated.length,
    };
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
    syncWithCloud,
  };
}
