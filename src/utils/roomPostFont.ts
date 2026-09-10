import type { RoomPost } from '../types/room';
import {
  DEFAULT_FONT_SIZE_ID,
  defaultFontIdForLanguage,
} from './fonts';

const SHARED_FONT_KEY = 'picture-diary-room-post-fonts';
const ENTRIES_KEY = 'picture-diary-entries';

type FontMeta = { fontId: string; fontSize: string };

function readSharedFontMap(): Record<string, FontMeta> {
  try {
    const raw = localStorage.getItem(SHARED_FONT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FontMeta>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSharedFontMap(map: Record<string, FontMeta>) {
  try {
    localStorage.setItem(SHARED_FONT_KEY, JSON.stringify(map));
  } catch {
    // quota 등은 무시
  }
}

/** 친구방 공유 시 작성 폰트 기억 (서버가 fontId를 안 돌려줘도 표시용) */
export function rememberSharedDiaryFont(
  diaryId: string,
  fontId?: string | null,
  fontSize?: string | null,
) {
  const id = diaryId.trim();
  if (!id) return;
  const meta: FontMeta = {
    fontId: fontId?.trim() || defaultFontIdForLanguage(),
    fontSize: fontSize?.trim() || DEFAULT_FONT_SIZE_ID,
  };
  const map = readSharedFontMap();
  map[id] = meta;
  writeSharedFontMap(map);
}

function fontFromLocalDiary(diaryId: string): Partial<FontMeta> {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return {};
    const entries = JSON.parse(raw) as Array<{
      id?: string;
      fontId?: string;
      fontSize?: string;
    }>;
    if (!Array.isArray(entries)) return {};
    const hit = entries.find((e) => e?.id === diaryId);
    if (!hit) return {};
    return {
      fontId: hit.fontId?.trim() || undefined,
      fontSize: hit.fontSize?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * 방 게시글에 쓸 글씨체.
 * 1) 서버 post.fontId
 * 2) 공유 시 로컬에 기억한 값
 * 3) 같은 diaryId의 내 일기
 * 4) 언어 기본
 */
export function resolveRoomPostFont(post: Pick<RoomPost, 'diaryId' | 'fontId' | 'fontSize'>): FontMeta {
  const fromPostId = post.fontId?.trim();
  const fromPostSize = post.fontSize?.trim();
  if (fromPostId) {
    return {
      fontId: fromPostId,
      fontSize: fromPostSize || DEFAULT_FONT_SIZE_ID,
    };
  }

  const diaryId = post.diaryId?.trim() ?? '';
  if (diaryId) {
    const remembered = readSharedFontMap()[diaryId];
    if (remembered?.fontId) {
      return {
        fontId: remembered.fontId,
        fontSize: remembered.fontSize || DEFAULT_FONT_SIZE_ID,
      };
    }
    const local = fontFromLocalDiary(diaryId);
    if (local.fontId) {
      return {
        fontId: local.fontId,
        fontSize: local.fontSize || DEFAULT_FONT_SIZE_ID,
      };
    }
  }

  return {
    fontId: defaultFontIdForLanguage(),
    fontSize: fromPostSize || DEFAULT_FONT_SIZE_ID,
  };
}

/** API 응답에 font가 없으면 로컬 해석 결과로 채움 */
export function enrichRoomPostFont<T extends RoomPost>(post: T): T {
  if (post.fontId?.trim()) return post;
  const resolved = resolveRoomPostFont(post);
  return {
    ...post,
    fontId: resolved.fontId,
    fontSize: post.fontSize?.trim() || resolved.fontSize,
  };
}

export function enrichRoomPostsFont<T extends RoomPost>(posts: T[]): T[] {
  return posts.map((p) => enrichRoomPostFont(p));
}
