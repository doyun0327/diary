import type {
  CreateRoomPostBody,
  RoomComment,
  RoomDetail,
  RoomPost,
  RoomSummary,
} from '../types/room';
import { apiUrl, isRemoteApi } from './config';
import { getAccessToken } from '../hooks/useAuthSession';

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAccessToken();
  if (!token) {
    throw new Error('로그인이 필요해요');
  }
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(extra ?? {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = authHeaders(init?.headers);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new Error(
      isRemoteApi()
        ? '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
        : '서버에 연결하지 못했어요. Spring(8080)이 켜져 있는지 확인해 주세요.',
    );
  }
  if (res.status === 401) {
    throw new Error('로그인이 필요해요');
  }
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function listRooms(): Promise<RoomSummary[]> {
  return request<RoomSummary[]>('/api/rooms');
}

/** 해당 일기가 이미 공유된 방 id 목록 */
export function listRoomsSharingDiary(diaryId: string): Promise<string[]> {
  return request<string[]>(`/api/rooms/shared-diaries/${encodeURIComponent(diaryId)}`);
}

export function createRoom(
  name: string,
  nickname?: string,
  avatarUrl?: string | null,
): Promise<RoomSummary> {
  return request<RoomSummary>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name,
      nickname: nickname?.trim() || undefined,
      avatarUrl: avatarUrl || undefined,
    }),
  });
}

export function joinRoom(
  inviteCode: string,
  nickname?: string,
  avatarUrl?: string | null,
): Promise<RoomSummary> {
  return request<RoomSummary>('/api/rooms/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode,
      nickname: nickname?.trim() || undefined,
      avatarUrl: avatarUrl || undefined,
    }),
  });
}

/** 내가 속한 모든 방의 닉네임·프로필 사진 갱신 */
export function updateMyProfile(body: {
  nickname?: string;
  avatarUrl?: string | null;
}): Promise<void> {
  return request<void>('/api/rooms/me', {
    method: 'PATCH',
    body: JSON.stringify({
      nickname: body.nickname?.trim() || undefined,
      avatarUrl: body.avatarUrl === undefined ? undefined : body.avatarUrl,
    }),
  });
}

export function getRoom(roomId: string): Promise<RoomDetail> {
  return request<RoomDetail>(`/api/rooms/${roomId}`);
}

export function listRoomPosts(roomId: string): Promise<RoomPost[]> {
  return request<RoomPost[]>(`/api/rooms/${roomId}/posts`);
}

export function getRoomPost(roomId: string, postId: string): Promise<RoomPost> {
  return request<RoomPost>(`/api/rooms/${roomId}/posts/${postId}`);
}

export function createRoomPost(
  roomId: string,
  body: CreateRoomPostBody,
): Promise<RoomPost> {
  return request<RoomPost>(`/api/rooms/${roomId}/posts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteRoomPost(roomId: string, postId: string): Promise<void> {
  return request<void>(`/api/rooms/${roomId}/posts/${postId}`, {
    method: 'DELETE',
  });
}

export function listComments(
  roomId: string,
  postId: string,
): Promise<RoomComment[]> {
  return request<RoomComment[]>(`/api/rooms/${roomId}/posts/${postId}/comments`);
}

export function createComment(
  roomId: string,
  postId: string,
  text: string,
): Promise<RoomComment> {
  return request<RoomComment>(`/api/rooms/${roomId}/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
