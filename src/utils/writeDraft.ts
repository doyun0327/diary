import type { Mood } from '../types/diary';

const DRAFT_KEY = 'picture-diary-write-draft';

export interface WriteDraft {
  date: string;
  title: string;
  content: string;
  mood: Mood;
  fontId?: string;
  /** data URL 등 — AI·그림 포함 */
  imageUrl?: string;
  savedAt: string;
}

export function loadWriteDraft(): WriteDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WriteDraft;
    if (!parsed || typeof parsed.date !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWriteDraft(draft: Omit<WriteDraft, 'savedAt'>): void {
  try {
    const payload: WriteDraft = {
      ...draft,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // quota 등은 무시
  }
}

export function clearWriteDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function writeDraftHasContent(draft: Omit<WriteDraft, 'savedAt'>): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.content.trim() ||
      draft.imageUrl,
  );
}
