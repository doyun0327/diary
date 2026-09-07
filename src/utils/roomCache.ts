import type { RoomDetail, RoomPost, RoomPostPage, RoomSummaryPage } from '../types/room';

const FEED_TTL_MS = 60_000;
const LIST_TTL_MS = 30_000;

type RoomFeedEntry = {
  room: RoomDetail;
  page: number;
  size: number;
  posts: RoomPost[];
  totalElements: number;
  totalPages: number;
  at: number;
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
): RoomFeedEntry | null {
  const hit = feedByKey.get(feedKey(roomId, page, size));
  if (!hit) return null;
  if (Date.now() - hit.at > FEED_TTL_MS) {
    feedByKey.delete(feedKey(roomId, page, size));
    return null;
  }
  return hit;
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

export function getCachedRoomDetail(roomId: string): RoomDetail | null {
  const prefix = `${roomId}:`;
  for (const [key, entry] of feedByKey) {
    if (!key.startsWith(prefix)) continue;
    if (Date.now() - entry.at > FEED_TTL_MS) {
      feedByKey.delete(key);
      continue;
    }
    return entry.room;
  }
  return null;
}

export function getCachedRoomPost(roomId: string, postId: string): RoomPost | null {
  const prefix = `${roomId}:`;
  for (const [key, entry] of feedByKey) {
    if (!key.startsWith(prefix)) continue;
    if (Date.now() - entry.at > FEED_TTL_MS) {
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
