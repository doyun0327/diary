/** 배포 중 여부 — Worker가 동적 응답. 캐시 금지. */
export type DeployStatus = { maintenance: boolean };

const STATUS_URL = '/deploy-status.json';

export async function fetchDeployStatus(): Promise<DeployStatus> {
  const res = await fetch(`${STATUS_URL}?t=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`deploy-status HTTP ${res.status}`);
  }
  const data = (await res.json()) as Partial<DeployStatus>;
  return { maintenance: Boolean(data.maintenance) };
}
