const STORAGE_KEY = 'picture-diary-blocked-users-v1';
export const BLOCKED_USERS_CHANGE_EVENT = 'picture-diary-blocked-users-change';

function loadIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
  } catch {
    return [];
  }
}

function saveIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(BLOCKED_USERS_CHANGE_EVENT));
}

export function getBlockedUserIds(): string[] {
  return loadIds();
}

export function isUserBlocked(userId: string | null | undefined): boolean {
  const id = userId?.trim();
  if (!id) return false;
  return loadIds().includes(id);
}

export function blockUser(userId: string): boolean {
  const id = userId.trim();
  if (!id) return false;
  const ids = loadIds();
  if (ids.includes(id)) return true;
  ids.push(id);
  saveIds(ids);
  return true;
}

export function unblockUser(userId: string): boolean {
  const id = userId.trim();
  if (!id) return false;
  const next = loadIds().filter((x) => x !== id);
  if (next.length === loadIds().length) return false;
  saveIds(next);
  return true;
}

export function filterBlockedAuthorId<T extends { authorUserId: string }>(
  items: T[],
): T[] {
  const blocked = new Set(loadIds());
  if (blocked.size === 0) return items;
  return items.filter((item) => !blocked.has(item.authorUserId));
}

export function subscribeBlockedUsers(onChange: () => void) {
  window.addEventListener(BLOCKED_USERS_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(BLOCKED_USERS_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
