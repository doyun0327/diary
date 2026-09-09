const STORAGE_KEY = 'picture-diary-room-seen-v1';

interface RoomSeenStore {
  /** 방을 한 번이라도 열었으면 true — 첫 진입 시점의 일기는 NEW 제외 */
  initialized: Record<string, boolean>;
  seenPostIds: Record<string, string[]>;
}

function loadStore(): RoomSeenStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { initialized: {}, seenPostIds: {} };
    const parsed = JSON.parse(raw) as RoomSeenStore;
    return {
      initialized: parsed.initialized ?? {},
      seenPostIds: parsed.seenPostIds ?? {},
    };
  } catch {
    return { initialized: {}, seenPostIds: {} };
  }
}

function saveStore(state: RoomSeenStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** 방 첫 진입 시 이미 있던 일기는 NEW로 표시하지 않음 */
export function syncRoomPostsSeenBaseline(roomId: string, postIds: string[]) {
  if (!roomId) return;
  const state = loadStore();
  if (state.initialized[roomId]) return;

  const prev = new Set(state.seenPostIds[roomId] ?? []);
  for (const id of postIds) {
    if (id) prev.add(id);
  }
  state.seenPostIds[roomId] = [...prev];
  state.initialized[roomId] = true;
  saveStore(state);
}

/**
 * 첫 baseline 이후에 생긴(또는 아직 안 연) 글만 NEW.
 * 방 미초기화면 false — baseline 직전 깜빡임 방지.
 */
export function isRoomPostUnread(roomId: string, postId: string): boolean {
  if (!roomId || !postId) return false;
  const state = loadStore();
  if (!state.initialized[roomId]) return false;
  const seen = state.seenPostIds[roomId] ?? [];
  return !seen.includes(postId);
}

export function markRoomPostSeen(roomId: string, postId: string) {
  if (!roomId || !postId) return;
  const state = loadStore();
  const prev = new Set(state.seenPostIds[roomId] ?? []);
  prev.add(postId);
  state.seenPostIds[roomId] = [...prev];
  state.initialized[roomId] = true;
  saveStore(state);
}
