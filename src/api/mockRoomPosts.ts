import type { Mood } from '../types/diary';
import type { RoomPost } from '../types/room';

export const MOCK_POST_ID_PREFIX = 'mock-paging-post-';

const MOODS: Mood[] = [
  'happy',
  'calm',
  'excited',
  'love',
  'proud',
  'happy',
  'calm',
  'excited',
  'love',
  'proud',
  'happy',
  'calm',
  'excited',
  'love',
  'proud',
  'happy',
  'calm',
  'excited',
  'love',
  'proud',
  'happy',
];

const SNIPPETS = [
  '오늘은 아침에 일찍 일어나서 산책을 했다. 공기가 차갑지만 상쾌했다.',
  '점심에 친구랑 파스타 먹었는데 소스가 진짜 맛있었다. 다음에 또 가자고 약속함.',
  '회의가 길어서 피곤했지만, 생각보다 잘 풀려서 뿌듯한 하루.',
  '비가 와서 창밖만 보고 있었는데 은근히 마음이 편해졌다.',
  '운동하고 나니까 몸이 가벼워진 느낌. 내일도 해야지.',
  '책 한 권 다 읽었다. 마지막 장면이 오래 남을 것 같다.',
  '엄마한테 전화했더니 목소리 들으니까 힘이 난다.',
  '커피 한 잔에 디저트까지. 작은 행복이 제일 크다.',
  '새 프로젝트 아이디어가 떠올랐다. 메모장에 적어두고 자야지.',
  '버스에서 노래 들으면서 창밖 구경. 그냥 평범한 날이 좋다.',
  '집 정리했더니 방이 넓어 보인다. 정리의 힘.',
  '저녁에 별이 잘 보였다. 잠깐 멈춰서 하늘을 봤다.',
  '오랜만에 그림 그렸는데 손이 서툴러도 재밌었다.',
  '일이 밀려서 바빴지만, 끝내고 나니 속이 시원하다.',
  '고양이 영상 보다가 한참 웃었다. 힐링 완료.',
  '따뜻한 차 한 잔과 함께 조용한 저녁.',
  '칭찬 한마디 받고 기분이 하루 종일 좋았다.',
  '계획 없이 걸었는데 새로운 골목을 발견했다.',
  '잠들기 전에 감사한 일 세 가지 적어봤다.',
  '주말이라 늦잠 잤다. 충분히 쉬는 것도 필요해.',
  '내일은 더 나은 하루가 되길. 오늘도 수고했다.',
];

export function isMockPagingPost(postId: string) {
  return postId.startsWith(MOCK_POST_ID_PREFIX);
}

/** 개발용 — 방 갤러리 페이징 테스트 (21개) */
export function devMockRoomPosts(roomId: string): RoomPost[] {
  if (!import.meta.env.DEV) return [];

  const base = new Date(2026, 0, 21);
  return Array.from({ length: 11 }, (_, i) => {
    const n = i + 1;
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    return {
      id: `${MOCK_POST_ID_PREFIX}${n}`,
      roomId,
      diaryId: `mock-diary-${n}`,
      authorUserId: 'mock-user',
      authorNickname: '테스트',
      title: `테스트 일기 ${n}`,
      date,
      content: SNIPPETS[i] ?? `테스트 일기 내용 ${n}번째입니다.`,
      mood: MOODS[i] ?? 'calm',
      createdAt: d.toISOString(),
    };
  });
}

export function getDevMockRoomPost(roomId: string, postId: string): RoomPost | null {
  if (!import.meta.env.DEV || !isMockPagingPost(postId)) return null;
  return devMockRoomPosts(roomId).find((p) => p.id === postId) ?? null;
}
