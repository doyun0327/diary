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
      map.set(entry.id, normalizeEntry(entry));
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
    mood: entry.mood,
    fontId: entry.fontId || undefined,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
