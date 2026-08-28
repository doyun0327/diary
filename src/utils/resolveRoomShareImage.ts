import { getDiaryImage } from './diaryImageStore';
import { compressDataUrlForShare } from './shareImageUrl';

async function remoteUrlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** 친구방 공유용 — 8/26 방식: IndexedDB·data URL에서 그림을 찾아 압축 JPEG data URL로 전달 */
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
    const dataUrl = await remoteUrlToDataUrl(raw);
    if (dataUrl) {
      raw = dataUrl;
    } else {
      return raw;
    }
  }

  return compressDataUrlForShare(raw);
}
