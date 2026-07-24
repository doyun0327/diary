import type {
  CreateRoomPostBody,
  RoomComment,
  RoomDetail,
  RoomPost,
  RoomSummary,
} from '../types/room';
import { getClientHeaders } from '../hooks/useClientProfile';

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getClientHeaders(),
    ...(init?.headers ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new Error(
      '서버에 연결하지 못했어요. Spring(8080)이 켜져 있는지 확인해 주세요.',
    );
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

export function createRoom(name: string, nickname?: string): Promise<RoomSummary> {
  return request<RoomSummary>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name,
      // 한글/기호 닉네임은 헤더 대신 body로 전달 (fetch 헤더 ASCII 제한 회피)
      nickname: nickname?.trim() || undefined,
    }),
  });
}

export function joinRoom(inviteCode: string, nickname?: string): Promise<RoomSummary> {
  return request<RoomSummary>('/api/rooms/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode,
      nickname: nickname?.trim() || undefined,
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
