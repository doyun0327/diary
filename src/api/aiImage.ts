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

/** UI 진행 단계 (백엔드는 한 요청 안에서 프롬프트 조립 → SD 3.5 이미지) */
export type AiProgress = 'prompt' | 'image';

export interface AiDrawResult {
  imageUrl: string;
  /** 백엔드가 이해한 장면/프롬프트 (표시·디버그용, 선택) */
  scene?: string;
  /** 최종 이미지 프롬프트 (선택) */
  prompt?: string;
}

/**
 * 백엔드에 AI 그림 생성 1회 요청.
 *
 * POST /api/ai/draw
 * body: { diaryLine, title?, character? }
 * response: { imageUrl? | imageBase64?, scene?, prompt? }
 * - GCS 사용 시 imageUrl(HTTPS)만 옴 → 그대로 사용
 * - 로컬 폴백 시 imageBase64(data URL)
 */
export async function generateDiaryImage(input: {
  title?: string;
  content: string;
  character?: CharacterProfile;
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

  input.onProgress?.('image');
  console.info('[AI] status:', response.status);

  if (!response.ok) {
    let message = `그림 생성 실패: HTTP ${response.status}`;
    if (response.status === 501) {
      message =
        'AI 그림 API가 아직 준비되지 않았어요 (501). 백엔드 SD 3.5 연동을 확인해 주세요';
    }
    try {
      const err = (await response.json()) as { message?: string };
      if (err.message) message = err.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    imageBase64?: string;
    imageUrl?: string;
    scene?: string;
    prompt?: string;
  };

  console.info('[AI] response keys:', Object.keys(data));

  let scene = data.scene?.trim() || data.prompt?.trim();
  if (scene) {
    scene = scene.replace(/[a-f0-9]{24,}/gi, ' ').replace(/\s+/g, ' ').trim();
    console.info('[AI] scene/prompt:', scene);
  }

  // 캔버스 export(toDataURL)를 위해 data URL을 우선 사용.
  // GCS https URL만 쓰면 CORS 없이 그릴 때 캔버스가 tainted 되어 저장이 깨짐.
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

  throw new Error('백엔드 응답에 이미지가 없습니다');
}
