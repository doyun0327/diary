import type { DiarySticker, MoodPackId } from './diary';

export interface RoomMember {
  userId: string;
  nickname: string;
  /** 프로필 사진 data URL 또는 http(s) URL */
  avatarUrl?: string | null;
  joinedAt: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  memberCount?: number;
  /** 내가 방장(생성자)인지 */
  owner?: boolean;
  /** CSS 스크랩 커버 프리셋 id (예: kraft, mint). 없으면 기본값 */
  coverPreset?: string | null;
  /** 갤러리에서 고른 커버 이미지 (data URL 또는 http(s)). 있으면면 preset보다 우선 */
  coverUrl?: string | null;
}

export interface RoomDetail extends RoomSummary {
  members: RoomMember[];
}

export interface RoomPost {
  id: string;
  roomId: string;
  diaryId: string;
  authorUserId: string;
  authorNickname: string;
  title: string;
  date: string;
  content: string;
  mood: DiarySticker;
  moodPack?: MoodPackId;
  imageUrl?: string;
  createdAt: string;
}

export interface RoomComment {
  id: string;
  postId: string;
  authorUserId: string;
  authorNickname: string;
  text: string;
  createdAt: string;
}

export interface CreateRoomPostBody {
  diaryId: string;
  title: string;
  date: string;
  content: string;
  mood: DiarySticker;
  moodPack?: MoodPackId;
  imageUrl?: string;
}
