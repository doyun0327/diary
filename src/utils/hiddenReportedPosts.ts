const STORAGE_KEY = 'picture-diary-hidden-reported-posts-v1';
export const HIDDEN_REPORTED_POSTS_CHANGE_EVENT =
  'picture-diary-hidden-reported-posts-change';

function loadIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    ];
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
  window.dispatchEvent(new Event(HIDDEN_REPORTED_POSTS_CHANGE_EVENT));
}

export function isReportedPostHidden(postId: string | null | undefined): boolean {
  const id = postId?.trim();
  if (!id) return false;
  return loadIds().includes(id);
}

/** 신고한 사람 기기에서만 해당 게시글 숨김 */
export function hideReportedPost(postId: string): boolean {
  const id = postId.trim();
  if (!id) return false;
  const ids = loadIds();
  if (ids.includes(id)) return true;
  ids.push(id);
  saveIds(ids);
  return true;
}

export function filterHiddenReportedPosts<T extends { id: string }>(
  items: T[],
): T[] {
  const hidden = new Set(loadIds());
  if (hidden.size === 0) return items;
  return items.filter((item) => !hidden.has(item.id));
}

export function subscribeHiddenReportedPosts(onChange: () => void) {
  window.addEventListener(HIDDEN_REPORTED_POSTS_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(HIDDEN_REPORTED_POSTS_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
