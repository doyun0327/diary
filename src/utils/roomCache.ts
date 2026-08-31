import type { RoomDetail, RoomPost, RoomSummaryPage } from '../types/room';

const FEED_TTL_MS = 60_000;
const LIST_TTL_MS = 30_000;

type RoomFeedEntry = {
  room: RoomDetail;
  posts: RoomPost[];
  at: number;
};

type RoomsListCache = {
  page: number;
  size: number;
  data: RoomSummaryPage;
  at: number;
};

const feedByRoomId = new Map<string, RoomFeedEntry>();
let roomsList: RoomsListCache | null = null;

export function getCachedRoomFeed(roomId: string): RoomFeedEntry | null {
  const hit = feedByRoomId.get(roomId);
  if (!hit) return null;
  if (Date.now() - hit.at > FEED_TTL_MS) {
    feedByRoomId.delete(roomId);
    return null;
  }
  return hit;
}

export function setCachedRoomFeed(
  roomId: string,
  room: RoomDetail,
  posts: RoomPost[],
): void {
  feedByRoomId.set(roomId, { room, posts, at: Date.now() });
}

export function getCachedRoomPost(roomId: string, postId: string): RoomPost | null {
  const feed = getCachedRoomFeed(roomId);
  if (!feed) return null;
  return feed.posts.find((p) => p.id === postId) ?? null;
}

export function invalidateRoomFeed(roomId: string): void {
  feedByRoomId.delete(roomId);
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
