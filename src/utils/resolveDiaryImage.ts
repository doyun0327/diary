import { uploadDiaryImage } from '../api/diariesApi';
import { getAccessToken } from '../hooks/useAuthSession';
import { compressDataUrlForDiary } from './shareImageUrl';

/**
 * 저장 전 그림 정리.
 * - data URL + 로그인 → GCS 업로드 후 https URL
 * - 실패/비로그인 → 압축 data URL (IndexedDB 폴백용)
 */
export async function resolveDiaryImageForSave(
  imageUrl: string | undefined | null,
): Promise<string | undefined> {
  if (!imageUrl?.trim()) return undefined;
  const raw = imageUrl.trim();

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  if (!raw.startsWith('data:')) {
    return raw;
  }

  const compressed = (await compressDataUrlForDiary(raw)) ?? raw;
  const token = getAccessToken();
  if (!token) {
    return compressed;
  }

  try {
    return await uploadDiaryImage(token, compressed);
  } catch (err) {
    console.warn('[diary] GCS upload failed, keep local image', err);
    return compressed;
  }
}
