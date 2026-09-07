import { reportUgc as reportUgcApi, type UgcReportBody } from '../api/roomsApi';

const QUEUE_KEY = 'picture-diary-ugc-reports-v1';

export type ReportReasonId =
  | 'spam'
  | 'harassment'
  | 'sexual'
  | 'hate'
  | 'other';

export const REPORT_REASON_IDS: ReportReasonId[] = [
  'spam',
  'harassment',
  'sexual',
  'hate',
  'other',
];

function loadQueue(): UgcReportBody[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UgcReportBody[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: UgcReportBody[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-100)));
  } catch {
    // ignore
  }
}

/** 서버로 보내고, 실패해도 로컬에 남겨 운영 확인 가능하게 함 */
export async function submitUgcReport(body: UgcReportBody): Promise<'sent' | 'queued'> {
  const payload: UgcReportBody = {
    ...body,
    createdAt: body.createdAt || new Date().toISOString(),
  };
  try {
    await reportUgcApi(payload);
    return 'sent';
  } catch {
    const queue = loadQueue();
    queue.push(payload);
    saveQueue(queue);
    return 'queued';
  }
}
