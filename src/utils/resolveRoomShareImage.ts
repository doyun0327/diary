import { getDiaryImage } from './diaryImageStore';
import { compressDataUrlForShare } from './shareImageUrl';

/** 친구방 공유용 이미지.
 * - 이미 http(s)(GCS 등)면 다운·압축·재업로드 없이 URL 그대로
 * - data URL / IndexedDB 만 trim+JPEG 압축 후 전달 (서버가 GCS에 올림)
 */
export async function resolveEntryImageForRoomShare(
  entry: { id: string; imageUrl?: string | null },
): Promise<string | undefined> {
  let raw = entry.imageUrl?.trim();
  if (!raw) {
    try {
      raw = (await getDiaryImage(entry.id))?.trim();
    } catch {
      // ignore
    }
  }
  if (!raw) return undefined;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  return compressDataUrlForShare(raw);
}
