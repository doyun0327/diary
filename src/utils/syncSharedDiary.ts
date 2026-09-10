import * as roomsApi from '../api/roomsApi';
import { getAccessToken } from '../hooks/useAuthSession';
import type { DiaryEntry } from '../types/diary';
import { invalidateRoomFeed, invalidateRoomsList } from './roomCache';
import { resolveEntryImageForRoomShare } from './resolveRoomShareImage';
import { rememberSharedDiaryFont } from './roomPostFont';
import {
  DEFAULT_FONT_SIZE_ID,
  defaultFontIdForLanguage,
} from './fonts';

type SharedDiaryFields = Pick<
  DiaryEntry,
  'title' | 'date' | 'content' | 'mood' | 'moodPack' | 'imageUrl' | 'fontId' | 'fontSize'
>;

/** 일기 수정 후, 친구방에 공유된 동일 일기 게시글을 서버에 맞춰 갱신 */
export async function syncSharedDiaryAfterEdit(
  diaryId: string,
  entry: SharedDiaryFields,
): Promise<void> {
  if (!getAccessToken() || !diaryId.trim()) return;

  try {
    const imageUrl = await resolveEntryImageForRoomShare({
      id: diaryId,
      imageUrl: entry.imageUrl,
    });

    const fontId = entry.fontId?.trim() || defaultFontIdForLanguage();
    const fontSize = entry.fontSize?.trim() || DEFAULT_FONT_SIZE_ID;

    const res = await roomsApi.updateSharedDiary(diaryId, {
      title: entry.title,
      date: entry.date,
      content: entry.content,
      mood: entry.mood,
      moodPack: entry.moodPack,
      imageUrl,
      fontId,
      fontSize,
    });

    rememberSharedDiaryFont(diaryId, fontId, fontSize);

    for (const roomId of res.roomIds ?? []) {
      invalidateRoomFeed(roomId);
    }
  } catch (err) {
    console.warn('[rooms] shared diary sync failed', err);
  }
}

/** 일기 삭제 후, 친구방에 공유된 동일 일기 게시글을 서버에서 제거 */
export async function syncSharedDiaryAfterDelete(diaryId: string): Promise<void> {
  if (!getAccessToken() || !diaryId.trim()) return;

  try {
    const res = await roomsApi.deleteSharedDiary(diaryId);
    for (const roomId of res.roomIds ?? []) {
      invalidateRoomFeed(roomId);
    }
    if ((res.roomIds?.length ?? 0) > 0) {
      invalidateRoomsList();
    }
  } catch (err) {
    console.warn('[rooms] shared diary delete failed', err);
  }
}
