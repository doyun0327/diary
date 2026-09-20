import type { AiDrawStyleId } from '../utils/aiDrawStyles';
import { normalizeAiDrawStyleId, stylePromptFor } from '../utils/aiDrawStyles';
import { apiUrl, isRemoteApi } from './config';

/**
 * 일기 본문 전체에서 AI용 텍스트 추출.
 * 줄바꿈은 공백으로 정리하고, 빈 줄은 제거한다.
 */
export function extractSceneLine(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** UI 진행 단계 — 백엔드 queued / running / done 과 대응 */
export type AiProgress = 'waiting' | 'drawing' | 'finishing';

export const AI_PROGRESS_STEPS: AiProgress[] = ['waiting', 'drawing', 'finishing'];

export interface AiDrawResult {
  imageUrl: string;
  /** 백엔드가 이해한 장면/프롬프트 (표시·디버그용, 선택) */
  scene?: string;
  /** 최종 이미지 프롬프트 (선택) */
  prompt?: string;
  /** CDN fallback 등 사용자 안내 */
  notice?: string;
  /** runware-cdn 등 */
  imageSource?: string;
  /** 앱이 백그라운드일 때 완료됨 → 로컬 알림 대상 */
  completedInBackground?: boolean;
}

type DrawPayload = {
  imageBase64?: string;
  imageUrl?: string;
  scene?: string;
  prompt?: string;
  jobId?: string;
  status?: string;
  message?: string;
  notice?: string;
  refundUsage?: string;
  usageRefunded?: string;
  imageSource?: string;
};

/** 그림 job 실패 — 사용권 환불 안내 포함 가능 */
export class AiDrawJobError extends Error {
  notice?: string;
  refundUsage: boolean;
  usageRefunded: boolean;

  constructor(
    message: string,
    opts?: { notice?: string; refundUsage?: boolean; usageRefunded?: boolean },
  ) {
    super(message);
    this.name = 'AiDrawJobError';
    this.notice = opts?.notice?.trim() || undefined;
    this.refundUsage = Boolean(opts?.refundUsage);
    this.usageRefunded = Boolean(opts?.usageRefunded);
  }
}

const POLL_INTERVAL_MS = 1500;
/** 앱이 보이는 동안에만 카운트 (백그라운드 체류는 제외) */
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_NETWORK_RETRY_MS = 2000;
const POLL_MAX_NETWORK_RETRIES_IN_ROW = 40;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseImageResult(data: DrawPayload): AiDrawResult {
  let scene = data.scene?.trim() || data.prompt?.trim();
  if (scene) {
    scene = scene.replace(/[a-f0-9]{24,}/gi, ' ').replace(/\s+/g, ' ').trim();
    console.info('[AI] scene/prompt:', scene);
  }

  const notice = data.notice?.trim() || undefined;
  const imageSource = data.imageSource?.trim() || undefined;
  if (notice) {
    console.info('[AI] notice:', notice);
  }

  if (data.imageBase64) {
    const imageUrl = data.imageBase64.startsWith('data:')
      ? data.imageBase64
      : `data:image/png;base64,${data.imageBase64}`;
    return { imageUrl, scene, prompt: data.prompt?.trim(), notice, imageSource };
  }

  if (data.imageUrl?.startsWith('data:')) {
    return { imageUrl: data.imageUrl, scene, prompt: data.prompt?.trim(), notice, imageSource };
  }

  if (data.imageUrl?.startsWith('http://') || data.imageUrl?.startsWith('https://')) {
    return { imageUrl: data.imageUrl, scene, prompt: data.prompt?.trim(), notice, imageSource };
  }

  throw aiError('백엔드 응답에 이미지가 없습니다');
}

function humanizeAiError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('quota exceeded') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('free_tier_requests')
  ) {
    const retryMatch = message.match(/retry in ([\d.]+)\s*s/i);
    if (retryMatch) {
      const sec = Math.max(1, Math.ceil(Number.parseFloat(retryMatch[1])));
      if (sec <= 180) {
        return `AI 사용 한도에 잠시 걸렸어요. ${sec}초 후에 다시 시도해 주세요.`;
      }
    }
    return 'AI 사용 한도에 걸렸어요. 1~2분 후에 다시 시도해 주세요.';
  }
  if (lower.includes('rate limit') || lower.includes('rate-limit')) {
    return '그림 요청이 많아요. 잠시 후 다시 시도해 주세요';
  }
  if (
    lower.includes('generativelanguage.googleapis.com') ||
    lower.includes('google.dev/gemini') ||
    lower.includes('model: gemini')
  ) {
    return 'AI 서버가 바빠서 그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  return message;
}

function aiError(message: string): Error {
  return new Error(humanizeAiError(message));
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const err = (await response.json()) as { message?: string };
    if (err.message) return humanizeAiError(err.message);
  } catch {
    // ignore
  }
  return humanizeAiError(fallback);
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

async function fetchDrawJobStatus(jobId: string): Promise<DrawPayload> {
  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/ai/draw/${encodeURIComponent(jobId)}`), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('network');
  }

  if (!response.ok) {
    // 5xx·일시 오류는 재시도, 4xx는 즉시 실패
    if (response.status >= 500 || response.status === 429) {
      throw new Error('network');
    }
    throw new Error(await readErrorMessage(response, `그림 상태 조회 실패: HTTP ${response.status}`));
  }

  return (await response.json()) as DrawPayload;
}

async function pollDrawJob(
  jobId: string,
  onProgress?: (step: AiProgress) => void,
): Promise<AiDrawResult> {
  // 서버 job 는 앱과 무관하게 계속 돌아감.
  // 폴링도 백그라운드에서 끊지 않음 — 타임아웃은 포그라운드에서만 셈.
  // (절대 상한만 두어 좀비 폴링 방지)
  const ABSOLUTE_MAX_MS = 30 * 60 * 1000;
  let visibleElapsed = 0;
  let networkFailStreak = 0;
  const wallStart = Date.now();
  onProgress?.('waiting');

  while (
    (isDocumentHidden() || visibleElapsed < POLL_TIMEOUT_MS) &&
    Date.now() - wallStart < ABSOLUTE_MAX_MS
  ) {
    const sliceStart = Date.now();
    const wasHidden = isDocumentHidden();

    let data: DrawPayload;
    try {
      data = await fetchDrawJobStatus(jobId);
      networkFailStreak = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'network') {
        networkFailStreak += 1;
        if (networkFailStreak > POLL_MAX_NETWORK_RETRIES_IN_ROW) {
          throw new Error(
            isRemoteApi()
              ? '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요'
              : '서버에 연결하지 못했어요. 백엔드(8080)가 켜져 있는지 확인해 주세요',
          );
        }
        console.warn('[AI] poll network retry', networkFailStreak, 'jobId=', jobId);
        if (!isDocumentHidden()) {
          visibleElapsed += Date.now() - sliceStart;
        }
        await sleep(POLL_NETWORK_RETRY_MS);
        continue;
      }
      throw err instanceof Error ? err : new Error(msg);
    }

    const status = (data.status || '').toLowerCase();
    console.info('[AI] poll jobId=', jobId, 'status=', status);

    if (status === 'done') {
      onProgress?.('finishing');
      await sleep(450);
      return {
        ...parseImageResult(data),
        completedInBackground: wasHidden || isDocumentHidden(),
      };
    }
    if (status === 'failed') {
      const refundUsage = data.refundUsage === 'true';
      const usageRefunded =
        data.usageRefunded === 'true' || data.refundUsage === 'done';
      throw new AiDrawJobError(data.message?.trim() || '그림 생성에 실패했습니다', {
        notice: data.notice,
        refundUsage,
        usageRefunded,
      });
    }

    if (status === 'running') {
      onProgress?.('drawing');
    } else {
      onProgress?.('waiting');
    }

    if (!isDocumentHidden()) {
      visibleElapsed += Date.now() - sliceStart;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  // 타임아웃 직전 한 번 더 확인
  try {
    const last = await fetchDrawJobStatus(jobId);
    const status = (last.status || '').toLowerCase();
    if (status === 'done') {
      onProgress?.('finishing');
      return {
        ...parseImageResult(last),
        completedInBackground: isDocumentHidden(),
      };
    }
    if (status === 'failed') {
      throw new AiDrawJobError(last.message?.trim() || '그림 생성에 실패했습니다', {
        notice: last.notice,
        refundUsage: last.refundUsage === 'true',
        usageRefunded:
          last.usageRefunded === 'true' || last.refundUsage === 'done',
      });
    }
  } catch (err) {
    if (err instanceof AiDrawJobError) throw err;
  }

  throw new Error('그림 생성이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요');
}

/**
 * 백엔드에 AI 그림 생성 요청 (비동기 큐).
 *
 * - 사진 경로: referenceImage + webtoonHero|oilPastel|jpRetroFilm
 * - 일기 경로: diaryLine + style textOil (캐릭터·사진 없음)
 *
 * POST /api/ai/draw → 202 { jobId, status: queued }
 * GET  /api/ai/draw/{jobId} → queued|running|done|failed
 */
export async function generateDiaryImage(input: {
  title?: string;
  content?: string;
  /** webtoonHero | oilPastel | jpRetroFilm | textOil */
  style?: AiDrawStyleId;
  /** 사진 경로 필수. textOil 이면 생략 */
  referenceImage?: string | null;
  /** textOil 주인공 외형 (성별·연령 기반). 없으면 서버 기본 a child */
  character?: string | null;
  /** 있으면 Authorization 포함 — Runware 400 시 서버 자동 환불용 */
  accessToken?: string | null;
  onProgress?: (step: AiProgress) => void;
}): Promise<AiDrawResult> {
  const title = input.title?.trim() ?? '';
  const diaryLine = extractSceneLine(input.content ?? '') || title;
  const referenceImage = input.referenceImage?.trim() || '';
  const styleId = normalizeAiDrawStyleId(input.style);
  const isTextOil = styleId === 'textOil';
  const character = input.character?.trim() || '';

  if (!isTextOil && !referenceImage.startsWith('data:image/')) {
    throw new Error('그림을 만들려면 사진을 첨부해 주세요');
  }
  if (isTextOil && !diaryLine) {
    throw new Error('일기 내용을 먼저 적어 주세요');
  }

  const stylePrompt = stylePromptFor(styleId);

  const payload: Record<string, unknown> = {
    diaryLine: diaryLine || undefined,
    title: title || undefined,
    sceneMode: 'full' as const,
    style: styleId,
  };
  // textOil: 프로필 성별·연령 → character 만 전송 (사진·stylePrompt 없음)
  if (isTextOil) {
    if (character) payload.character = character;
  } else {
    if (stylePrompt) payload.stylePrompt = stylePrompt;
    payload.referenceImage = referenceImage;
    payload.referenceImageBase64 = referenceImage;
  }

  console.info('[AI] ===== POST /api/ai/draw =====');
  console.info(
    '[AI] body keys:',
    Object.keys(payload),
    'hasRef=',
    !isTextOil,
    'style=',
    styleId,
  );

  input.onProgress?.('waiting');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (input.accessToken?.trim()) {
    headers.Authorization = `Bearer ${input.accessToken.trim()}`;
  }

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/ai/draw'), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      isRemoteApi()
        ? '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요'
        : '서버에 연결하지 못했어요. 백엔드(8080)가 켜져 있는지 확인해 주세요',
    );
  }

  console.info('[AI] status:', response.status);

  if (!response.ok && response.status !== 202) {
    let message = `그림 생성 실패: HTTP ${response.status}`;
    if (response.status === 413) {
      message = 'photo-too-large';
    } else if (response.status === 429) {
      message = '그림 요청이 많아요. 잠시 후 다시 시도해 주세요';
    } else if (response.status === 501) {
      message =
        'AI 그림 API가 아직 준비되지 않았어요 (501). 백엔드 SD 3.5 연동을 확인해 주세요';
    }
    message = await readErrorMessage(response, message);
    throw aiError(message);
  }

  const data = (await response.json()) as DrawPayload;
  console.info('[AI] response keys:', Object.keys(data));

  // 비동기 큐: 202 또는 body에 jobId만 있는 경우(프록시가 200으로 바꿀 때 포함)
  const st = (data.status || '').toLowerCase();
  if (data.jobId && (response.status === 202 || st === 'queued' || st === 'running')) {
    console.info('[AI] queued jobId=', data.jobId);
    return pollDrawJob(data.jobId, input.onProgress);
  }

  // legacy sync 200 (이미지 바로 포함)
  input.onProgress?.('drawing');
  input.onProgress?.('finishing');
  await sleep(450);
  return {
    ...parseImageResult(data),
    completedInBackground: isDocumentHidden(),
  };
}
