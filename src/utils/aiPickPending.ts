/**
 * AI 그림 선택(이전 그림 / 새 그림) — 배포 새로고침에도 유지.
 * 이미지·캔버스는 IndexedDB, 메타는 sessionStorage.
 */
import type { DiaryCanvasState } from '../types/diary';
import {
  deleteDiaryCanvasJson,
  deleteDiaryImage,
  getDiaryCanvasJson,
  getDiaryImage,
  putDiaryCanvasJson,
  putDiaryImage,
} from './diaryImageStore';

const FLAG_KEY = 'picture-diary-ai-pick-pending';
const META_KEY = 'picture-diary-ai-pick-meta';
const OPT_PREFIX = '__ai_pick_opt_';
const HIST_PREFIX = '__ai_pick_hist_';
const OPT_CANVAS_SUFFIX = '__canvas';

export type AiPickPendingOption = {
  src: string;
  kind: 'canvas' | 'ai';
  aiIndex?: number;
  canvasState?: DiaryCanvasState | null;
};

type StoredOptionMeta = {
  kind: 'canvas' | 'ai';
  aiIndex?: number;
  mediaId: string;
  hasCanvasState: boolean;
};

type StoredMeta = {
  options: StoredOptionMeta[];
  selected: number[];
  historyMediaIds: string[];
};

export function hasAiPickPending(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function setPendingFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(FLAG_KEY, '1');
    else sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* ignore */
  }
}

async function clearStoredMedia(meta: StoredMeta | null) {
  if (!meta) return;
  const tasks: Promise<void>[] = [];
  for (const opt of meta.options) {
    tasks.push(deleteDiaryImage(opt.mediaId));
    if (opt.hasCanvasState) {
      tasks.push(deleteDiaryCanvasJson(`${opt.mediaId}${OPT_CANVAS_SUFFIX}`));
    }
  }
  for (const id of meta.historyMediaIds) {
    tasks.push(deleteDiaryImage(id));
  }
  await Promise.all(tasks);
}

function readMeta(): StoredMeta | null {
  try {
    const raw = sessionStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredMeta;
  } catch {
    return null;
  }
}

function writeMeta(meta: StoredMeta) {
  try {
    sessionStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export async function clearAiPickPending(): Promise<void> {
  const meta = readMeta();
  setPendingFlag(false);
  try {
    sessionStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
  await clearStoredMedia(meta);
}

export async function saveAiPickPending(input: {
  options: AiPickPendingOption[];
  selected: number[];
  aiGeneratedImages: string[];
}): Promise<void> {
  if (input.options.length === 0) {
    await clearAiPickPending();
    return;
  }

  const prev = readMeta();
  await clearStoredMedia(prev);

  const options: StoredOptionMeta[] = [];
  for (let i = 0; i < input.options.length; i++) {
    const opt = input.options[i]!;
    const mediaId = `${OPT_PREFIX}${i}`;
    await putDiaryImage(mediaId, opt.src);
    let hasCanvasState = false;
    if (opt.kind === 'canvas' && opt.canvasState) {
      await putDiaryCanvasJson(
        `${mediaId}${OPT_CANVAS_SUFFIX}`,
        JSON.stringify(opt.canvasState),
      );
      hasCanvasState = true;
    }
    options.push({
      kind: opt.kind,
      aiIndex: opt.aiIndex,
      mediaId,
      hasCanvasState,
    });
  }

  const historyMediaIds: string[] = [];
  for (let i = 0; i < input.aiGeneratedImages.length; i++) {
    const id = `${HIST_PREFIX}${i}`;
    await putDiaryImage(id, input.aiGeneratedImages[i]!);
    historyMediaIds.push(id);
  }

  const meta: StoredMeta = {
    options,
    selected: input.selected,
    historyMediaIds,
  };
  writeMeta(meta);
  setPendingFlag(true);
}

export async function loadAiPickPending(): Promise<{
  options: AiPickPendingOption[];
  selected: number[];
  aiGeneratedImages: string[];
} | null> {
  if (!hasAiPickPending()) return null;
  const meta = readMeta();
  if (!meta?.options?.length) {
    await clearAiPickPending();
    return null;
  }

  const options: AiPickPendingOption[] = [];
  for (const opt of meta.options) {
    const src = await getDiaryImage(opt.mediaId);
    if (!src) continue;
    let canvasState: DiaryCanvasState | null = null;
    if (opt.hasCanvasState) {
      try {
        const raw = await getDiaryCanvasJson(`${opt.mediaId}${OPT_CANVAS_SUFFIX}`);
        if (raw) canvasState = JSON.parse(raw) as DiaryCanvasState;
      } catch {
        canvasState = null;
      }
    }
    options.push({
      src,
      kind: opt.kind,
      aiIndex: opt.aiIndex,
      canvasState,
    });
  }

  if (options.length === 0) {
    await clearAiPickPending();
    return null;
  }

  const aiGeneratedImages: string[] = [];
  for (const id of meta.historyMediaIds) {
    const src = await getDiaryImage(id);
    if (src) aiGeneratedImages.push(src);
  }

  const selected = (meta.selected ?? [])
    .filter((i) => i >= 0 && i < options.length);

  return {
    options,
    selected: selected.length > 0 ? selected : options.map((_, i) => i),
    aiGeneratedImages,
  };
}
