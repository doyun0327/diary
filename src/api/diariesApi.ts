import { apiUrl } from './config';
import type { DiaryEntry } from '../types/diary';

export interface DiarySyncRequest {
  since: string | null;
  entries: DiaryEntry[];
  deletedIds: string[];
}

export interface DiarySyncResponse {
  serverTime: string;
  entries: DiaryEntry[];
  deletedIds: string[];
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const err = (await res.json()) as { message?: string };
    if (err.message) return err.message;
  } catch {
    // ignore
  }
  return `${fallback} (HTTP ${res.status})`;
}

/** 서버에 있는 내 일기 전체 (삭제 제외) */
export async function fetchDiaries(accessToken: string): Promise<DiaryEntry[]> {
  const res = await fetch(apiUrl('/api/diaries'), {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '일기 불러오기 실패'));
  }
  return (await res.json()) as DiaryEntry[];
}

/** LWW 동기화: 로컬 변경·삭제 push 후 서버 변경 pull */
export async function syncDiaries(
  accessToken: string,
  body: DiarySyncRequest,
): Promise<DiarySyncResponse> {
  const res = await fetch(apiUrl('/api/diaries/sync'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      since: body.since,
      entries: body.entries,
      deletedIds: body.deletedIds,
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '동기화 실패'));
  }
  return (await res.json()) as DiarySyncResponse;
}
