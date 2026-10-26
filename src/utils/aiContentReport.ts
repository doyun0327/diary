import { apiUrl } from '../api/config';
import { API_UI_TIMEOUT_MS, fetchWithTimeout } from '../api/fetchTimeout';
import { getAccessToken } from '../hooks/useAuthSession';
import type { ReportReasonId } from './ugcReport';

const QUEUE_KEY = 'picture-diary-ai-content-reports-v1';

export type AiContentReportBody = {
  reason: ReportReasonId;
  source?: 'diary' | 'photo';
  promptSnippet?: string;
  createdAt?: string;
};

function loadQueue(): AiContentReportBody[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AiContentReportBody[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: AiContentReportBody[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)));
  } catch {
    // ignore
  }
}

/** 서버 접수. 실패해도 로컬에 남겨 두고 화면에서는 성공으로 처리 */
export async function submitAiContentReport(body: AiContentReportBody): Promise<void> {
  const payload: AiContentReportBody = {
    ...body,
    promptSnippet: (body.promptSnippet ?? '').slice(0, 500),
    createdAt: body.createdAt || new Date().toISOString(),
  };
  try {
    const token = getAccessToken();
    const headers: HeadersInit = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchWithTimeout(
      apiUrl('/api/ai/reports'),
      { method: 'POST', headers, body: JSON.stringify(payload) },
      API_UI_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    const queue = loadQueue();
    queue.push(payload);
    saveQueue(queue);
  }
}
