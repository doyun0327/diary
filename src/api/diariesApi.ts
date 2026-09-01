import { apiUrl } from './config';
import type { DiaryEntry } from '../types/diary';

export interface DiarySyncRequest {
  since: string | null;
  entries: DiaryEntry[];
  deletedIds: string[];
  /** YYYY-MM — 해당 월만 pull */
  month?: string | null;
}

export type SyncCloudOptions = {
  /** YYYY-MM — 없으면 서버가 전체 pull */
  month?: string | null;
  /** true면 업로드 없이 해당 월만 받기 */
  pullOnly?: boolean;
};

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
      month: body.month ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '동기화 실패'));
  }
  return (await res.json()) as DiarySyncResponse;
}

/** 일기 그림 data URL → GCS HTTPS URL */
export async function uploadDiaryImage(
  accessToken: string,
  imageUrl: string,
): Promise<string> {
  const res = await fetch(apiUrl('/api/diaries/images'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ imageUrl }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '그림 업로드 실패'));
  }
  const data = (await res.json()) as { imageUrl?: string };
  const url = data.imageUrl?.trim();
  if (!url) {
    throw new Error('그림 업로드 응답이 비어 있어요');
  }
  return url;
}
