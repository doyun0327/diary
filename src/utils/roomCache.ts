import type { RoomDetail, RoomPost, RoomPostPage, RoomSummaryPage } from '../types/room';

/** 신선 — 재요청 없이 바로 사용 */
const FEED_FRESH_MS = 90_000;
/** 만료 후에도 화면용으로 잠깐 쓸 수 있는 기간 (백그라운드 갱신) */
const FEED_STALE_MS = 10 * 60_000;
const LIST_TTL_MS = 30_000;

export type RoomFeedEntry = {
  room: RoomDetail;
  page: number;
  size: number;
  posts: RoomPost[];
  totalElements: number;
  totalPages: number;
  at: number;
  /** true면 캐시는 있으나 TTL 지나서 백그라운드 갱신 권장 */
  stale?: boolean;
};

type RoomsListCache = {
  page: number;
  size: number;
  data: RoomSummaryPage;
  at: number;
};

/** key: `${roomId}:${page}:${size}` */
const feedByKey = new Map<string, RoomFeedEntry>();
let roomsList: RoomsListCache | null = null;

const ROOM_FEED_PAGE_KEY = 'picture-diary-room-feed-page';
const roomFeedPageMem = new Map<string, number>();

/** 글 상세 들어갔다 나와도 같은 피드 페이지 유지 */
export function getRememberedRoomFeedPage(roomId: string): number {
  const id = roomId.trim();
  if (!id) return 0;
  const mem = roomFeedPageMem.get(id);
  if (typeof mem === 'number' && mem >= 0) return mem;
  try {
    const raw = sessionStorage.getItem(ROOM_FEED_PAGE_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    const n = map[id];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
      const page = Math.floor(n);
      roomFeedPageMem.set(id, page);
      return page;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export function rememberRoomFeedPage(roomId: string, page: number): void {
  const id = roomId.trim();
  if (!id) return;
  const next = Math.max(0, Math.floor(page));
  roomFeedPageMem.set(id, next);
  try {
    const raw = sessionStorage.getItem(ROOM_FEED_PAGE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, number>;
    map[id] = next;
    sessionStorage.setItem(ROOM_FEED_PAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** 방 목록·다른 메뉴로 나갈 때 — 다음에 들어오면 1페이지부터 */
export function clearRememberedRoomFeedPage(roomId?: string | null): void {
  const id = roomId?.trim();
  if (!id) {
    roomFeedPageMem.clear();
    try {
      sessionStorage.removeItem(ROOM_FEED_PAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  roomFeedPageMem.delete(id);
  try {
    const raw = sessionStorage.getItem(ROOM_FEED_PAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, number>;
    delete map[id];
    sessionStorage.setItem(ROOM_FEED_PAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function feedKey(roomId: string, page: number, size: number) {
  return `${roomId}:${page}:${size}`;
}

export function getCachedRoomFeed(
  roomId: string,
  page = 0,
  size = 10,
  opts?: { allowStale?: boolean },
): RoomFeedEntry | null {
  const key = feedKey(roomId, page, size);
  const hit = feedByKey.get(key);
  if (!hit) return null;
  const age = Date.now() - hit.at;
  if (age <= FEED_FRESH_MS) {
    return { ...hit, stale: false };
  }
  if (opts?.allowStale && age <= FEED_STALE_MS) {
    return { ...hit, stale: true };
  }
  if (age > FEED_STALE_MS) {
    feedByKey.delete(key);
  }
  return null;
}

export function setCachedRoomFeed(
  roomId: string,
  room: RoomDetail,
  postsPage: RoomPostPage,
): void {
  const content = Array.isArray(postsPage.content) ? postsPage.content : [];
  const page = typeof postsPage.page === 'number' ? postsPage.page : 0;
  const size = typeof postsPage.size === 'number' ? postsPage.size : 10;
  const totalElements =
    typeof postsPage.totalElements === 'number'
      ? postsPage.totalElements
      : content.length;
  let totalPages =
    typeof postsPage.totalPages === 'number' && postsPage.totalPages >= 1
      ? postsPage.totalPages
      : Math.max(1, Math.ceil(totalElements / size) || 1);
  if (content.length > 0) {
    totalPages = Math.max(totalPages, page + 1);
  }
  feedByKey.set(feedKey(roomId, page, size), {
    room,
    page,
    size,
    posts: content,
    totalElements,
    totalPages,
    at: Date.now(),
  });
}

export function getCachedRoomDetail(
  roomId: string,
  opts?: { allowStale?: boolean },
): RoomDetail | null {
  const prefix = `${roomId}:`;
  for (const [key, entry] of feedByKey) {
    if (!key.startsWith(prefix)) continue;
    const age = Date.now() - entry.at;
    if (age <= FEED_FRESH_MS) return entry.room;
    if (opts?.allowStale && age <= FEED_STALE_MS) return entry.room;
    if (age > FEED_STALE_MS) feedByKey.delete(key);
  }
  return null;
}

export function getCachedRoomPost(roomId: string, postId: string): RoomPost | null {
  const prefix = `${roomId}:`;
  for (const [key, entry] of feedByKey) {
    if (!key.startsWith(prefix)) continue;
    const age = Date.now() - entry.at;
    if (age > FEED_STALE_MS) {
      feedByKey.delete(key);
      continue;
    }
    const hit = entry.posts.find((p) => p.id === postId);
    if (hit) return hit;
  }
  return null;
}

export function invalidateRoomFeed(roomId: string): void {
  const prefix = `${roomId}:`;
  for (const key of [...feedByKey.keys()]) {
    if (key.startsWith(prefix)) feedByKey.delete(key);
  }
}

export function getCachedRoomsList(
  page = 0,
  size = 10,
): RoomSummaryPage | null {
  if (!roomsList) return null;
  if (roomsList.page !== page || roomsList.size !== size) return null;
  if (Date.now() - roomsList.at > LIST_TTL_MS) {
    roomsList = null;
    return null;
  }
  return roomsList.data;
}

export function setCachedRoomsList(data: RoomSummaryPage): void {
  roomsList = {
    page: data.page,
    size: data.size,
    data,
    at: Date.now(),
  };
}

export function invalidateRoomsList(): void {
  roomsList = null;
}

/** 프로필(닉·프사) 변경 후 방/피드 캐시 전부 무효화 */
export function invalidateAllRoomCaches(): void {
  feedByKey.clear();
  roomsList = null;
}
