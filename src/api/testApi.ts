import { apiUrl } from './config';

export interface TestApiResponse {
  message: string;
  status: 'ok' | string;
}

export async function testBackendConnection(): Promise<TestApiResponse> {
  const response = await fetch(apiUrl('/api/test'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`백엔드 연결 실패: HTTP ${response.status}`);
  }

  const data = (await response.json()) as TestApiResponse;

  if (data.status !== 'ok') {
    throw new Error(`예상하지 못한 응답 상태: ${data.status}`);
  }

  return data;
}
