import { apiUrl } from './config';

export type MonthlyUsageDto = {
  yearMonth: string;
  used: number;
  limit: number;
  allowed?: boolean;
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

/** 계정의 이번 달 일기 작성 횟수 */
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

/** 신규 일기 1장 사용 (한도 초과면 409) */
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
