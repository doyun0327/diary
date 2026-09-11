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
  feedByKey.set(feedKey(roomId, page, size), {
    room,
    page,
    size,
    posts: content,
    totalElements:
      typeof postsPage.totalElements === 'number'
        ? postsPage.totalElements
        : content.length,
    totalPages: Math.max(
      1,
      typeof postsPage.totalPages === 'number' ? postsPage.totalPages : 1,
    ),
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
