import type { Mood } from './diary';

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
  mood: Mood;
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
  mood: Mood;
  imageUrl?: string;
}
