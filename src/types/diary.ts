export type MoodPackId =
  | 'classic'
  | 'weather'
  | 'smileys'
  | 'cat'
  | 'dog'
  | 'love'
  | 'ghost'
  | 'numbers'
  | 'numbers2';

/** 수정 시 사진별로 다시 움직이도록 저장하는 레이어 */
export interface DiaryCanvasPhoto {
  id: string;
  src: string;
  /** normalized면 0~1, 아니면 CSS px */
  x: number;
  y: number;
  width: number;
  height: number;
  aspect: number;
  rotation: number;
}

export interface DiaryCanvasSticker {
  id: string;
  emoji: string;
  imageSrc?: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

export interface DiaryCanvasState {
  viewWidth: number;
  viewHeight: number;
  /** true면 좌표·크기가 view 대비 0~1 */
  normalized?: boolean;
  photos: DiaryCanvasPhoto[];
  stickers: DiaryCanvasSticker[];
  /** 펜 잉크만 — 반드시 투명 PNG (JPEG/trim 금지) */
  inkUrl?: string;
}

/** 그림 일기 한 편 */
export interface DiaryEntry {
  id: string;
  /** 일기 날짜 (YYYY-MM-DD) */
  date: string;
  /** 제목 */
  title: string;
  /** 일기 본문 */
  content: string;
  /** 미리보기용 합성 이미지 (data URL 또는 https) */
  imageUrl?: string;
  /** 수정용 레이어 — 있으면 사진/펜을 각각 편집 */
  canvasState?: DiaryCanvasState;
  /** 그날 고른 스티커 (기분 또는 숫자) */
  mood: DiarySticker;
  /** 이 일기를 쓸 때 쓰던 이모지 팩. 이후 꾸미기에서 바꿔도 유지 */
  moodPack?: MoodPackId;
  /** 이 일기에 쓴 글씨체 id (fonts.ts). 없으면 기본 폰트 */
  fontId?: string;
  /** 이 일기에 쓴 글씨 크기 (sm/md/lg/xl). 없으면 보통 */
  fontSize?: string;
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
  /** PDF·공유 카드 등 텍스트/캔버스·클래식 팩용 */
  emoji: string;
  label: string;
}

export const MOODS: MoodOption[] = [
  { value: 'happy', emoji: '☺️', label: '행복해요' },
  { value: 'excited', emoji: '🥳', label: '신나요' },
  { value: 'love', emoji: '😍', label: '사랑스러워요' },
  { value: 'proud', emoji: '🌟', label: '뿌듯해요' },
  { value: 'calm', emoji: '☁️', label: '평온해요' },
  { value: 'sleepy', emoji: '💤', label: '졸려요' },
  { value: 'soso', emoji: '🫧', label: '그저 그래요' },
  { value: 'surprised', emoji: '😳', label: '놀랐어요' },
  { value: 'sad', emoji: '🥺', label: '슬퍼요' },
  { value: 'angry', emoji: '😤', label: '화나요' },
  { value: 'anxious', emoji: '😥', label: '불안해요' },
  { value: 'sick', emoji: '🤧', label: '아파요' },
];

export const MOOD_MAP: Record<Mood, MoodOption> = Object.fromEntries(
  MOODS.map((m) => [m.value, m]),
) as Record<Mood, MoodOption>;

/** 숫자 팩 스티커. 기분(happy 등)과는 매핑하지 않음 */
export const NUMBER_STICKERS = [
  '10',
  '20',
  '30',
  '40',
  '50',
  '60',
  '70',
  '80',
  '90',
  '100',
] as const;

export type NumberSticker = (typeof NUMBER_STICKERS)[number];
export type DiarySticker = Mood | NumberSticker;

const NUMBER_STICKER_SET = new Set<string>(NUMBER_STICKERS);

export function isMood(value: string | undefined | null): value is Mood {
  return typeof value === 'string' && value in MOOD_MAP;
}

export function isNumberSticker(value: string | undefined | null): value is NumberSticker {
  return typeof value === 'string' && NUMBER_STICKER_SET.has(value);
}
