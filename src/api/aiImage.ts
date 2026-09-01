import type { CharacterProfile } from '../types/character';
import { describeCharacter } from '../types/character';
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

/** UI 진행 단계 (백엔드는 큐 접수 → 이미지 생성) */
export type AiProgress = 'prompt' | 'image';

export interface AiDrawResult {
  imageUrl: string;
  /** 백엔드가 이해한 장면/프롬프트 (표시·디버그용, 선택) */
  scene?: string;
  /** 최종 이미지 프롬프트 (선택) */
  prompt?: string;
}

type DrawPayload = {
  imageBase64?: string;
  imageUrl?: string;
  scene?: string;
  prompt?: string;
  jobId?: string;
  status?: string;
  message?: string;
};

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseImageResult(data: DrawPayload): AiDrawResult {
  let scene = data.scene?.trim() || data.prompt?.trim();
  if (scene) {
    scene = scene.replace(/[a-f0-9]{24,}/gi, ' ').replace(/\s+/g, ' ').trim();
    console.info('[AI] scene/prompt:', scene);
  }

  if (data.imageBase64) {
    const imageUrl = data.imageBase64.startsWith('data:')
      ? data.imageBase64
      : `data:image/png;base64,${data.imageBase64}`;
    return { imageUrl, scene, prompt: data.prompt?.trim() };
  }

  if (data.imageUrl?.startsWith('data:')) {
    return { imageUrl: data.imageUrl, scene, prompt: data.prompt?.trim() };
  }

  if (data.imageUrl?.startsWith('http://') || data.imageUrl?.startsWith('https://')) {
    return { imageUrl: data.imageUrl, scene, prompt: data.prompt?.trim() };
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

async function pollDrawJob(jobId: string, onProgress?: (step: AiProgress) => void): Promise<AiDrawResult> {
  const started = Date.now();
  onProgress?.('image');

  while (Date.now() - started < POLL_TIMEOUT_MS) {
    let response: Response;
    try {
      response = await fetch(apiUrl(`/api/ai/draw/${encodeURIComponent(jobId)}`), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new Error(
        isRemoteApi()
          ? '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요'
          : '서버에 연결하지 못했어요. 백엔드(8080)가 켜져 있는지 확인해 주세요',
      );
    }

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `그림 상태 조회 실패: HTTP ${response.status}`));
    }

    const data = (await response.json()) as DrawPayload;
    const status = (data.status || '').toLowerCase();
    console.info('[AI] poll jobId=', jobId, 'status=', status);

    if (status === 'done') {
      return parseImageResult(data);
    }
    if (status === 'failed') {
      throw aiError(data.message?.trim() || '그림 생성에 실패했습니다');
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('그림 생성이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요');
}

/**
 * 백엔드에 AI 그림 생성 요청 (비동기 큐).
 *
 * POST /api/ai/draw → 202 { jobId, status: queued }
 * GET  /api/ai/draw/{jobId} → queued|running|done|failed
 *
 * 구버전 동기 200 응답도 그대로 지원.
 */
/** wacky = LLM 없음, full = Gemini 장면 해석 */
export type AiDrawSceneMode = 'wacky' | 'full';

export async function generateDiaryImage(input: {
  title?: string;
  content: string;
  character?: CharacterProfile;
  sceneMode?: AiDrawSceneMode;
  onProgress?: (step: AiProgress) => void;
}): Promise<AiDrawResult> {
  const title = input.title?.trim() ?? '';
  const diaryLine = extractSceneLine(input.content) || title;

  if (!diaryLine) {
    throw new Error('그림을 만들려면 일기 내용을 먼저 적어 주세요');
  }

  const character = input.character
    ? describeCharacter(input.character)
    : undefined;

  const payload = {
    diaryLine,
    title: title || undefined,
    character,
    sceneMode: input.sceneMode ?? 'wacky',
  };

  console.info('[AI] ===== POST /api/ai/draw =====');
  console.info('[AI] body:', payload);

  input.onProgress?.('prompt');

  let response: Response;
  try {
    response = await fetch(apiUrl('/api/ai/draw'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
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
    if (response.status === 429) {
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
  input.onProgress?.('image');
  return parseImageResult(data);
}
