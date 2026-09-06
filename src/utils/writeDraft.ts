import type { DiaryCanvasState, DiarySticker } from '../types/diary';
import {
  deleteDiaryCanvasJson,
  deleteDiaryImage,
  getDiaryCanvasJson,
  getDiaryImage,
  isEmbeddedDataUrl,
  putDiaryCanvasJson,
  putDiaryImage,
} from './diaryImageStore';

const DRAFT_KEY = 'picture-diary-write-draft';
const DRAFT_MEDIA_ID = '__write_draft__';

export interface WriteDraft {
  date: string;
  title: string;
  content: string;
  mood: DiarySticker;
  fontId?: string;
  fontSize?: string;
  /** 수정 중이면 해당 일기 id */
  editingId?: string | null;
  /** 그림/캔버스가 있어 복원할 가치 있음 */
  hasDrawing?: boolean;
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
  void clearWriteDraftMedia();
}

export function writeDraftHasContent(draft: Omit<WriteDraft, 'savedAt'> | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    draft.title.trim() ||
      draft.content.trim() ||
      draft.hasDrawing ||
      draft.editingId,
  );
}

export async function saveWriteDraftMedia(input: {
  canvasState?: DiaryCanvasState | null;
  imageUrl?: string | null;
}): Promise<boolean> {
  try {
    const state = input.canvasState;
    if (state) {
      await putDiaryCanvasJson(DRAFT_MEDIA_ID, JSON.stringify(state));
    } else {
      await deleteDiaryCanvasJson(DRAFT_MEDIA_ID);
    }
    if (isEmbeddedDataUrl(input.imageUrl)) {
      await putDiaryImage(DRAFT_MEDIA_ID, input.imageUrl!);
    } else if (!input.imageUrl) {
      await deleteDiaryImage(DRAFT_MEDIA_ID);
    }
    return true;
  } catch (err) {
    console.warn('[draft] media save failed', err);
    return false;
  }
}

export async function loadWriteDraftMedia(): Promise<{
  canvasState?: DiaryCanvasState;
  imageUrl?: string;
}> {
  try {
    const [raw, imageUrl] = await Promise.all([
      getDiaryCanvasJson(DRAFT_MEDIA_ID),
      getDiaryImage(DRAFT_MEDIA_ID),
    ]);
    let canvasState: DiaryCanvasState | undefined;
    if (raw) {
      canvasState = JSON.parse(raw) as DiaryCanvasState;
    }
    return { canvasState, imageUrl };
  } catch {
    return {};
  }
}

export async function clearWriteDraftMedia(): Promise<void> {
  try {
    await deleteDiaryCanvasJson(DRAFT_MEDIA_ID);
    await deleteDiaryImage(DRAFT_MEDIA_ID);
  } catch {
    // ignore
  }
}

/** 배포 새로고침 직전 등 — 작성 화면이 동기 flush 하도록 */
export const DRAFT_FLUSH_EVENT = 'diary-flush-draft';

export function requestDraftFlush(): void {
  window.dispatchEvent(new Event(DRAFT_FLUSH_EVENT));
}
