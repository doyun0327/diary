import type { DiaryEntry } from '../types/diary';

/** updatedAt 기준 LWW. deletedIds는 로컬에서 제거. */
export function mergeDiaryEntries(
  local: DiaryEntry[],
  remote: DiaryEntry[],
  deletedIds: string[],
): DiaryEntry[] {
  const deleted = new Set(deletedIds.filter(Boolean));
  const map = new Map<string, DiaryEntry>();

  for (const entry of local) {
    if (!entry?.id || deleted.has(entry.id)) continue;
    map.set(entry.id, entry);
  }

  for (const entry of remote) {
    if (!entry?.id || deleted.has(entry.id)) continue;
    const prev = map.get(entry.id);
    if (!prev || isSameOrNewer(entry.updatedAt, prev.updatedAt)) {
      const next = normalizeEntry(entry);
      if (!next.moodPack && prev?.moodPack) next.moodPack = prev.moodPack;
      if (!next.fontSize && prev?.fontSize) next.fontSize = prev.fontSize;
      if (!next.canvasState && prev?.canvasState) next.canvasState = prev.canvasState;
      if (!next.imageUrl && prev?.imageUrl) next.imageUrl = prev.imageUrl;
      map.set(entry.id, next);
    }
  }

  for (const id of deleted) {
    map.delete(id);
  }

  return Array.from(map.values()).sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || ''),
  );
}

function isSameOrNewer(a: string | undefined, b: string | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return a >= b;
}

function normalizeEntry(entry: DiaryEntry): DiaryEntry {
  return {
    id: entry.id,
    date: entry.date,
    title: entry.title ?? '',
    content: entry.content ?? '',
    imageUrl: entry.imageUrl || undefined,
    canvasState: entry.canvasState,
    mood: entry.mood,
    moodPack: entry.moodPack,
    fontId: entry.fontId || undefined,
    fontSize: entry.fontSize || undefined,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
