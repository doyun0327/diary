import { apiUrl } from './config';

export type MonthlyUsageDto = {
  yearMonth: string;
  used: number;
  limit: number;
  allowed?: boolean;
  /** 환불 시 사용자 안내 */
  notice?: string | null;
};

export type AiPackCreditsDto = {
  credits: number;
  notice?: string | null;
};

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

/** 계정의 이번 달 AI 그림 생성 횟수 */
export async function fetchMonthlyUsage(
  accessToken: string,
): Promise<MonthlyUsageDto> {
  const res = await fetch(apiUrl('/api/usage/monthly'), {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '월간 한도 조회 실패'));
  }
  return (await res.json()) as MonthlyUsageDto;
}

/** AI 그림 1회 사용 (작성·수정 동일, 한도 초과면 409) */
export async function consumeMonthlyUsage(
  accessToken: string,
): Promise<MonthlyUsageDto> {
  const res = await fetch(apiUrl('/api/usage/monthly/consume'), {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '월간 한도 차감 실패'));
  }
  return (await res.json()) as MonthlyUsageDto;
}

/** Runware 400 등 생성 실패 시 월간 카운트 1회 환불 */
export async function refundMonthlyUsage(
  accessToken: string,
): Promise<MonthlyUsageDto> {
  const res = await fetch(apiUrl('/api/usage/monthly/refund'), {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, '월간 한도 환불 실패'));
  }
  return (await res.json()) as MonthlyUsageDto;
}

export async function fetchAiPackCredits(
  accessToken: string,
): Promise<AiPackCreditsDto> {
  const res = await fetch(apiUrl('/api/usage/ai-pack'), {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'AI 팩 잔여 조회 실패'));
  }
  return (await res.json()) as AiPackCreditsDto;
}

export async function grantAiPackCreditsRemote(
  accessToken: string,
  count: number,
): Promise<AiPackCreditsDto> {
  const res = await fetch(apiUrl('/api/usage/ai-pack/grant'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ count }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'AI 팩 지급 실패'));
  }
  return (await res.json()) as AiPackCreditsDto;
}

export async function consumeAiPackCreditsRemote(
  accessToken: string,
): Promise<AiPackCreditsDto> {
  const res = await fetch(apiUrl('/api/usage/ai-pack/consume'), {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'AI 팩 차감 실패'));
  }
  return (await res.json()) as AiPackCreditsDto;
}

export async function refundAiPackCreditsRemote(
  accessToken: string,
): Promise<AiPackCreditsDto> {
  const res = await fetch(apiUrl('/api/usage/ai-pack/refund'), {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'AI 팩 환불 실패'));
  }
  return (await res.json()) as AiPackCreditsDto;
}
