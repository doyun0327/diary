import type { CharacterProfile } from '../types/character';
import { describeCharacter } from '../types/character';

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
 * 이미지 모델은 백엔드에서만 사용: stabilityai/stable-diffusion-3.5-large
 *
 * POST /api/ai/draw
 * body: { diaryLine, title?, character? }
 * response: { imageBase64 | imageUrl, scene?, prompt? }
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
    response = await fetch('/api/ai/draw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('서버에 연결하지 못했어요. 백엔드(8080)가 켜져 있는지 확인해 주세요');
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

  if (data.imageBase64) {
    const imageUrl = data.imageBase64.startsWith('data:')
      ? data.imageBase64
      : `data:image/png;base64,${data.imageBase64}`;
    return { imageUrl, scene, prompt: data.prompt?.trim() };
  }

  if (data.imageUrl) {
    const imgRes = await fetch(data.imageUrl);
    if (!imgRes.ok) {
      throw new Error('이미지 URL을 불러오지 못했습니다');
    }
    const blob = await imgRes.blob();
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('이미지 변환에 실패했습니다'));
      reader.readAsDataURL(blob);
    });
    return { imageUrl, scene, prompt: data.prompt?.trim() };
  }

  throw new Error('백엔드 응답에 이미지가 없습니다');
}
