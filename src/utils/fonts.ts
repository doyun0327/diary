export interface FontOption {
  id: string;
  /** 사용자에게 보여줄 이름 */
  label: string;
  /** CSS font-family 값 */
  family: string;
  category: 'cute' | 'neat';
}

export const FONT_CATEGORY_LABELS: Record<FontOption['category'], string> = {
  cute: '귀여운 글씨체',
  neat: '정직한 글씨체',
};

export const FONTS: FontOption[] = [
  // 귀여운 손글씨 계열
  { id: 'gaegu', label: '개구', family: "'Gaegu', cursive", category: 'cute' },
  { id: 'dongle', label: '동글', family: "'Dongle', sans-serif", category: 'cute' },
  { id: 'hi-melody', label: '히멜로디', family: "'Hi Melody', cursive", category: 'cute' },
  { id: 'single-day', label: '싱글데이', family: "'Single Day', cursive", category: 'cute' },
  { id: 'cute-font', label: '큐트폰트', family: "'Cute Font', cursive", category: 'cute' },
  { id: 'jua', label: '주아', family: "'Jua', sans-serif", category: 'cute' },
  { id: 'gamja-flower', label: '감자꽃', family: "'Gamja Flower', cursive", category: 'cute' },
  { id: 'poor-story', label: '푸어스토리', family: "'Poor Story', cursive", category: 'cute' },
  {
    id: 'nanum-pen',
    label: '나눔손글씨 펜',
    family: "'Nanum Pen Script', cursive",
    category: 'cute',
  },
  {
    id: 'nanum-brush',
    label: '나눔손글씨 붓',
    family: "'Nanum Brush Script', cursive",
    category: 'cute',
  },
  {
    id: 'east-sea-dokdo',
    label: '동해독도',
    family: "'East Sea Dokdo', cursive",
    category: 'cute',
  },
  { id: 'yeon-sung', label: '연성', family: "'Yeon Sung', cursive", category: 'cute' },

  // 정직하고 단정한 계열
  {
    id: 'noto-sans',
    label: '노토 산스',
    family: "'Noto Sans KR', sans-serif",
    category: 'neat',
  },
  {
    id: 'nanum-gothic',
    label: '나눔고딕',
    family: "'Nanum Gothic', sans-serif",
    category: 'neat',
  },
  {
    id: 'gowun-dodum',
    label: '고운돋움',
    family: "'Gowun Dodum', sans-serif",
    category: 'neat',
  },
  { id: 'gowun-batang', label: '고운바탕', family: "'Gowun Batang', serif", category: 'neat' },
  {
    id: 'nanum-myeongjo',
    label: '나눔명조',
    family: "'Nanum Myeongjo', serif",
    category: 'neat',
  },
  { id: 'song-myung', label: '송명', family: "'Song Myung', serif", category: 'neat' },
  { id: 'do-hyeon', label: '도현', family: "'Do Hyeon', sans-serif", category: 'neat' },
  {
    id: 'ibm-plex',
    label: 'IBM 플렉스',
    family: "'IBM Plex Sans KR', sans-serif",
    category: 'neat',
  },
];

export const DEFAULT_FONT_ID = 'gaegu';

/** 새 일기 기본 글씨체 (헤더/작성 도구에서 고른 마지막 값) */
export const FONT_PREFERENCE_KEY = 'picture-diary-font';

export function findFont(id: string | undefined | null): FontOption {
  if (!id) return FONTS.find((f) => f.id === DEFAULT_FONT_ID) ?? FONTS[0];
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export function getPreferredFontId(): string {
  try {
    return localStorage.getItem(FONT_PREFERENCE_KEY) ?? DEFAULT_FONT_ID;
  } catch {
    return DEFAULT_FONT_ID;
  }
}

export function setPreferredFontId(id: string) {
  try {
    localStorage.setItem(FONT_PREFERENCE_KEY, id);
  } catch {
    // ignore
  }
}

/** 일기 엔트리에 저장된 글씨체 (구버전 일기는 기본값) */
export function fontFamilyForEntry(fontId?: string): string {
  return findFont(fontId).family;
}
