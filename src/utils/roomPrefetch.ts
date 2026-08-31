import * as roomsApi from '../api/roomsApi';
import { getAccessToken } from '../hooks/useAuthSession';
import type { RoomSummaryPage } from '../types/room';
import {
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

/** 방 상세 + 공유 일기 — 캐시·진행 중 요청이 있으면 재사용 */
export function prefetchRoomFeed(
  roomId: string,
  opts?: { force?: boolean },
): Promise<void> {
  if (!getAccessToken() || !roomId.trim()) return Promise.resolve();

  if (!opts?.force && getCachedRoomFeed(roomId)) {
    return Promise.resolve();
  }

  return once(`room-feed:${roomId}`, async () => {
    const [detail, feed] = await Promise.all([
      roomsApi.getRoom(roomId),
      roomsApi.listRoomPosts(roomId),
    ]);
    setCachedRoomFeed(roomId, detail, feed);
  });
}
