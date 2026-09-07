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
    const cachedRoom = getCachedRoomDetail(roomId, { allowStale: true });
    if (cachedRoom) {
      const feed = await roomsApi.listRoomPosts(roomId, { page, size });
      setCachedRoomFeed(roomId, cachedRoom, feed);
      // 멤버/방 정보는 백그라운드로 최신화
      void roomsApi
        .getRoom(roomId)
        .then((detail) => {
          const latest = getCachedRoomFeed(roomId, page, size, { allowStale: true });
          if (latest) setCachedRoomFeed(roomId, detail, {
            content: latest.posts,
            page: latest.page,
            size: latest.size,
            totalElements: latest.totalElements,
            totalPages: latest.totalPages,
          });
        })
        .catch(() => {});
      return;
    }
    const [detail, feed] = await Promise.all([
      roomsApi.getRoom(roomId),
      roomsApi.listRoomPosts(roomId, { page, size }),
    ]);
    setCachedRoomFeed(roomId, detail, feed);
  });
}

/** 허브에서 보이는 방 피드 미리 받아 두기 */
export function prefetchVisibleRoomFeeds(roomIds: string[], limit = 5): void {
  if (!getAccessToken()) return;
  const ids = roomIds.filter(Boolean).slice(0, limit);
  const run = () => {
    for (const id of ids) {
      void prefetchRoomFeed(id, { page: 0, size: DEFAULT_POSTS_PAGE_SIZE });
    }
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 250);
  }
}
