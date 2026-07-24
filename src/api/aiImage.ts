import type { CharacterProfile } from '../types/character';
import { describeCharacter } from '../types/character';

/**
 * 일기에서 AI용 장면 텍스트 추출.
 * 첫 줄만이 아니라 앞부분(최대 3줄 / 160자)을 보내 장면이 더 잘 반영되게 함.
 */
export function extractSceneLine(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  let scene = lines.slice(0, 3).join(' ').replace(/\s+/g, ' ').trim();
  if (scene.length > 160) {
    scene = `${scene.slice(0, 160).trim()}…`;
  }
  return scene;
}

export type AiProgress = 'scene' | 'image';

/**
 * 백엔드(Spring Boot)에 AI 그림 생성 요청.
 * 프론트는 외부 AI API를 직접 호출하지 않는다.
 *
 * POST /api/ai/draw
 * body: { diaryLine, title?, character? }
 * response: { imageBase64 } 또는 { imageUrl }
 */
export async function generateDiaryImage(input: {
  title?: string;
  content: string;
  character?: CharacterProfile;
  onProgress?: (step: AiProgress) => void;
}): Promise<{ imageUrl: string; scene?: string }> {
  const title = input.title?.trim() ?? '';
  const diaryLine = extractSceneLine(input.content) || title;

  if (!diaryLine) {
    throw new Error('그림을 만들려면 일기 내용을 먼저 적어 주세요');
  }

  // 외형만 짧게 — 길면 일기가 무시되고 캐릭터만 나옴
  const character = input.character
    ? describeCharacter(input.character)
    : undefined;

  const payload = {
    diaryLine, // 일기 장면 (가장 중요)
    title: title || undefined,
    character, // 짧은 외형 힌트
  };

  console.info('[AI] ===== 백엔드 AI 그림 요청 =====');
  console.info('[AI] 요청 body:', payload);

  input.onProgress?.('scene');

  const response = await fetch('/api/ai/draw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  input.onProgress?.('image');

  console.info('[AI] 백엔드 응답 status:', response.status);

  if (!response.ok) {
    let message = `그림 생성 실패: HTTP ${response.status}`;
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
  };

  console.info('[AI] 백엔드 응답 키:', Object.keys(data));
  let scene = data.scene?.trim();
  if (scene) {
    // 백엔드가 해시 찌꺼기를 남긴 경우 화면/로그용으로만 정리
    scene = scene.replace(/[a-f0-9]{24,}/gi, ' ').replace(/\s+/g, ' ').trim();
    console.info('[AI] 생성된 장면 설명:', scene);
  }

  if (data.imageBase64) {
    console.info('[AI] ===== 그림 생성 완료 (base64) =====');
    const imageUrl = data.imageBase64.startsWith('data:')
      ? data.imageBase64
      : `data:image/png;base64,${data.imageBase64}`;
    return { imageUrl, scene };
  }

  if (data.imageUrl) {
    console.info('[AI] 이미지 URL 로드:', data.imageUrl);
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
    console.info('[AI] ===== 그림 생성 완료 (url) =====');
    return { imageUrl, scene };
  }

  throw new Error('백엔드 응답에 이미지가 없습니다');
}
