const STORAGE_KEY = 'picture-diary-room-seen-v1';

interface RoomSeenStore {
  /** 방을 한 번이라도 열었으면(또는 허브에서 피드 기준을 잡으면) true — 그 시점 일기는 NEW 제외 */
  initialized: Record<string, boolean>;
  seenPostIds: Record<string, string[]>;
}

/** localStorage 실패·쿼터 초과 시에도 세션 동안 N 배지가 동작하도록 */
let memoryStore: RoomSeenStore | null = null;

function emptyStore(): RoomSeenStore {
  return { initialized: {}, seenPostIds: {} };
}

function loadStore(): RoomSeenStore {
  if (memoryStore) return memoryStore;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryStore = emptyStore();
      return memoryStore;
    }
    const parsed = JSON.parse(raw) as RoomSeenStore;
    memoryStore = {
      initialized: parsed.initialized ?? {},
      seenPostIds: parsed.seenPostIds ?? {},
    };
    return memoryStore;
  } catch {
    memoryStore = emptyStore();
    return memoryStore;
  }
}

function saveStore(state: RoomSeenStore) {
  memoryStore = state;
  const raw = JSON.stringify(state);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
    return;
  } catch {
    // quota 등 — sessionStorage 폴백
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // 메모리만 유지
  }
}

/** 방 첫 진입(또는 허브 프리페치) 시 이미 있던 일기는 NEW로 표시하지 않음 */
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
  // initialized 는 baseline(허브/방 피드)에서만 켠다.
  // 푸시로 글 1개만 열었을 때 initialized=true 가 되면 나머지 옛 글이 전부 N 으로 뜨거나,
  // baseline 이 스킵되어 이후 새 글 추적이 꼬일 수 있음.
  saveStore(state);
}

/** 방 목록용 — 다른 사람 글 중 안 읽은 게 있으면 true */
export function roomHasUnreadPosts(
  roomId: string,
  posts: Array<{ id: string; authorUserId?: string }>,
  currentUserId?: string | null,
): boolean {
  if (!roomId || posts.length === 0) return false;
  const state = loadStore();
  if (!state.initialized[roomId]) return false;
  const seen = state.seenPostIds[roomId] ?? [];
  const seenSet = new Set(seen);
  const me = currentUserId?.trim() || '';
  return posts.some((p) => {
    if (!p.id || seenSet.has(p.id)) return false;
    if (me && p.authorUserId === me) return false;
    return true;
  });
}
