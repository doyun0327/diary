/** 그림 일기 한 편 */
export interface DiaryEntry {
  id: string;
  /** 일기 날짜 (YYYY-MM-DD) */
  date: string;
  /** 일기 본문 */
  content: string;
  /** 그림 이미지 (data URL 또는 이미지 경로) */
  imageUrl?: string;
  /** 그날의 기분 */
  mood: Mood;
  createdAt: string;
  updatedAt: string;
}

export type Mood =
  | 'happy'
  | 'excited'
  | 'love'
  | 'proud'
  | 'calm'
  | 'sleepy'
  | 'soso'
  | 'surprised'
  | 'sad'
  | 'angry'
  | 'anxious'
  | 'sick';

export interface MoodOption {
  value: Mood;
  emoji: string;
  label: string;
}

export const MOODS: MoodOption[] = [
  { value: 'happy', emoji: '😊', label: '행복해요' },
  { value: 'excited', emoji: '🤩', label: '신나요' },
  { value: 'love', emoji: '🥰', label: '사랑스러워요' },
  { value: 'proud', emoji: '😎', label: '뿌듯해요' },
  { value: 'calm', emoji: '😌', label: '평온해요' },
  { value: 'sleepy', emoji: '😴', label: '졸려요' },
  { value: 'soso', emoji: '😐', label: '그저 그래요' },
  { value: 'surprised', emoji: '😲', label: '놀랐어요' },
  { value: 'sad', emoji: '😢', label: '슬퍼요' },
  { value: 'angry', emoji: '😠', label: '화나요' },
  { value: 'anxious', emoji: '😟', label: '불안해요' },
  { value: 'sick', emoji: '🤒', label: '아파요' },
];

export const MOOD_MAP: Record<Mood, MoodOption> = Object.fromEntries(
  MOODS.map((m) => [m.value, m]),
) as Record<Mood, MoodOption>;
