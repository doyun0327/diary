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

/**
 * 펜 잉크 전용 — trim/JPEG 금지(투명 PNG 유지).
 * 로그인 시 PNG 그대로 GCS 업로드 시도, 실패 시 data URL 유지.
 */
export async function resolveInkImageForSave(
  inkUrl: string | undefined | null,
): Promise<string | undefined> {
  if (!inkUrl?.trim()) return undefined;
  const raw = inkUrl.trim();

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  if (!raw.startsWith('data:')) {
    return raw;
  }

  const token = getAccessToken();
  if (!token) {
    return raw;
  }

  try {
    return await uploadDiaryImage(token, raw);
  } catch (err) {
    console.warn('[diary] ink GCS upload failed, keep local PNG', err);
    return raw;
  }
}
