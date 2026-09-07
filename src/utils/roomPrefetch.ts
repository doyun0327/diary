import * as roomsApi from '../api/roomsApi';
import { getAccessToken } from '../hooks/useAuthSession';
import type { RoomSummaryPage } from '../types/room';
import {
  getCachedRoomDetail,
  getCachedRoomFeed,
  getCachedRoomsList,
  setCachedRoomFeed,
  setCachedRoomsList,
} from './roomCache';

const inflight = new Map<string, Promise<unknown>>();

function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/** 친구방 목록 — 캐시·진행 중 요청이 있으면 재사용 */
export function prefetchRoomsList(
  page = 0,
  size = 10,
): Promise<RoomSummaryPage | null> {
  if (!getAccessToken()) return Promise.resolve(null);

  const cached = getCachedRoomsList(page, size);
  if (cached) return Promise.resolve(cached);

  return once(`rooms-list:${page}:${size}`, async () => {
    const result = await roomsApi.listRooms({ page, size });
    setCachedRoomsList(result);
    return result;
  });
}

const DEFAULT_POSTS_PAGE_SIZE = 10;

/** 방 상세 + 공유 일기(해당 페이지만) — 캐시·진행 중 요청이 있으면 재사용 */
export function prefetchRoomFeed(
  roomId: string,
  opts?: { force?: boolean; page?: number; size?: number },
): Promise<void> {
  if (!getAccessToken() || !roomId.trim()) return Promise.resolve();

  const page = opts?.page ?? 0;
  const size = opts?.size ?? DEFAULT_POSTS_PAGE_SIZE;

  if (!opts?.force && getCachedRoomFeed(roomId, page, size)) {
    return Promise.resolve();
  }

  return once(`room-feed:${roomId}:${page}:${size}`, async () => {
    const cachedRoom = getCachedRoomDetail(roomId);
    if (cachedRoom) {
      const feed = await roomsApi.listRoomPosts(roomId, { page, size });
      setCachedRoomFeed(roomId, cachedRoom, feed);
      return;
    }
    const [detail, feed] = await Promise.all([
      roomsApi.getRoom(roomId),
      roomsApi.listRoomPosts(roomId, { page, size }),
    ]);
    setCachedRoomFeed(roomId, detail, feed);
  });
}
