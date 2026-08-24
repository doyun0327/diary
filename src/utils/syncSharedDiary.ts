import * as roomsApi from '../api/roomsApi';
import { getAccessToken } from '../hooks/useAuthSession';
import type { DiaryEntry } from '../types/diary';
import { invalidateRoomFeed } from './roomCache';
import { compressDataUrlForShare } from './shareImageUrl';

type SharedDiaryFields = Pick<
  DiaryEntry,
  'title' | 'date' | 'content' | 'mood' | 'moodPack' | 'imageUrl'
>;

/** 일기 수정 후, 친구방에 공유된 동일 일기 게시글을 서버에 맞춰 갱신 */
export async function syncSharedDiaryAfterEdit(
  diaryId: string,
  entry: SharedDiaryFields,
): Promise<void> {
  if (!getAccessToken() || !diaryId.trim()) return;

  try {
    const raw = entry.imageUrl?.trim();
    const imageUrl = raw
      ? raw.startsWith('data:')
        ? await compressDataUrlForShare(raw).catch(() => raw)
        : raw
      : undefined;

    const res = await roomsApi.updateSharedDiary(diaryId, {
      title: entry.title,
      date: entry.date,
      content: entry.content,
      mood: entry.mood,
      moodPack: entry.moodPack,
      imageUrl,
    });

    for (const roomId of res.roomIds ?? []) {
      invalidateRoomFeed(roomId);
    }
  } catch (err) {
    console.warn('[rooms] shared diary sync failed', err);
  }
}
