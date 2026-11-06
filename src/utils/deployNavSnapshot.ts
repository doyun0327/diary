/**
 * 배포 새로고침 후 작업 중이던 화면(작성·상세·방 등)을 복원하기 위한 스냅샷.
 */
export type DeployNavSnapshot = {
  page: 'home' | 'write' | 'detail' | 'rooms' | 'room' | 'room-post';
  editingId: string | null;
  selectedId: string | null;
  selectedDate: string;
  activeRoomId: string | null;
  activePostId: string | null;
  calYear: number;
  calMonth: number;
};

const KEY = 'picture-diary-deploy-nav';

const PAGES = new Set<DeployNavSnapshot['page']>([
  'home',
  'write',
  'detail',
  'rooms',
  'room',
  'room-post',
]);

export function saveDeployNavSnapshot(snap: DeployNavSnapshot): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function loadDeployNavSnapshot(): DeployNavSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeployNavSnapshot;
    if (!parsed || !PAGES.has(parsed.page)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDeployNavSnapshot(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** 앱 기동 시 한 번만 소비 */
export function consumeDeployNavSnapshot(): DeployNavSnapshot | null {
  const snap = loadDeployNavSnapshot();
  if (snap) clearDeployNavSnapshot();
  return snap;
}
