import { apiUrl } from './config';
import type { DiaryEntry } from '../types/diary';

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

/** 서버에 있는 내 일기 전체 (삭제 제외) — 클라우드 sync 비활성 중에도 조회용으로 유지 */
export async function fetchDiaries(accessToken: string): Promise<DiaryEntry[]> {
  const res = await fetch(apiUrl('/api/diaries'), {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '일기 불러오기 실패'));
  }
  return (await res.json()) as DiaryEntry[];
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
