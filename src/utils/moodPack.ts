import { useSyncExternalStore } from 'react';
import type { DiarySticker, Mood, MoodPackId, NumberSticker } from '../types/diary';
import { isMood, isNumberSticker, MOODS, NUMBER_STICKERS } from '../types/diary';

export type { MoodPackId };

export const MOOD_PACK_STORAGE_KEY = 'picture-diary-mood-pack';
export const MOOD_PACK_CHANGE_EVENT = 'mood-pack-change';

/** 팩별 아이콘 보정 — 원본 GIF/PNG 기울어짐 */
export const MOOD_ICON_TRANSFORMS: Partial<
  Record<MoodPackId, Partial<Record<Mood, string>>>
> = {
  smileys: {
    happy: 'rotate(-45deg)',
  },
};

/** Magnific · Flat Emoji pack (emoji-6) — 정적 PNG */
const CLASSIC_ICONS: Record<Mood, string> = {
  happy: '/moods/classic/happy.png',
  excited: '/moods/classic/excited.png',
  love: '/moods/classic/love.png',
  proud: '/moods/classic/proud.png',
  calm: '/moods/classic/calm.png',
  sleepy: '/moods/classic/sleepy.png',
  soso: '/moods/classic/soso.png',
  surprised: '/moods/classic/surprised.png',
  sad: '/moods/classic/sad.png',
  angry: '/moods/classic/angry.png',
  anxious: '/moods/classic/anxious.png',
  sick: '/moods/classic/sick.png',
};

/** Freepik smileys 애니 GIF */
const SMILEYS_ICONS: Record<Mood, string> = {
  happy: '/moods/happy.gif',
  excited: '/moods/excited.gif',
  love: '/moods/love.gif',
  proud: '/moods/proud.gif',
  calm: '/moods/calm.gif',
  sleepy: '/moods/sleepy.gif',
  soso: '/moods/soso.gif',
  surprised: '/moods/surprised.gif',
  sad: '/moods/sad.gif',
  angry: '/moods/angry.gif',
  anxious: '/moods/anxious.gif',
  sick: '/moods/sick.gif',
};

/** MrHamster · Cat emojis pack — 정적 PNG */
const CAT_ICONS: Record<Mood, string> = {
  happy: '/moods/cat/happy.png',
  excited: '/moods/cat/excited.png',
  love: '/moods/cat/love.png',
  proud: '/moods/cat/proud.png',
  calm: '/moods/cat/calm.png',
  sleepy: '/moods/cat/sleepy.png',
  soso: '/moods/cat/soso.png',
  surprised: '/moods/cat/surprised.png',
  sad: '/moods/cat/sad.png',
  angry: '/moods/cat/angry.png',
  anxious: '/moods/cat/anxious.png',
  sick: '/moods/cat/sick.png',
};

/** MrHamster · Dog emojis pack — 정적 PNG */
const DOG_ICONS: Record<Mood, string> = {
  happy: '/moods/dog/happy.png',
  excited: '/moods/dog/excited.png',
  love: '/moods/dog/love.png',
  proud: '/moods/dog/proud.png',
  calm: '/moods/dog/calm.png',
  sleepy: '/moods/dog/sleepy.png',
  soso: '/moods/dog/soso.png',
  surprised: '/moods/dog/surprised.png',
  sad: '/moods/dog/sad.png',
  angry: '/moods/dog/angry.png',
  anxious: '/moods/dog/anxious.png',
  sick: '/moods/dog/sick.png',
};

/** Rohim · Love Emoticons pack — 정적 PNG */
const LOVE_ICONS: Record<Mood, string> = {
  happy: '/moods/love/happy.png',
  excited: '/moods/love/excited.png',
  love: '/moods/love/love.png',
  proud: '/moods/love/proud.png',
  calm: '/moods/love/calm.png',
  sleepy: '/moods/love/sleepy.png',
  soso: '/moods/love/soso.png',
  surprised: '/moods/love/surprised.png',
  sad: '/moods/love/sad.png',
  angry: '/moods/love/angry.png',
  anxious: '/moods/love/anxious.png',
  sick: '/moods/love/sick.png',
};

/** iconixar · Weather Flat pack — 정적 PNG */
const WEATHER_ICONS: Record<Mood, string> = {
  happy: '/moods/weather/happy.png',
  excited: '/moods/weather/excited.png',
  love: '/moods/weather/love.png',
  proud: '/moods/weather/proud.png',
  calm: '/moods/weather/calm.png',
  sleepy: '/moods/weather/sleepy.png',
  soso: '/moods/weather/soso.png',
  surprised: '/moods/weather/surprised.png',
  sad: '/moods/weather/sad.png',
  angry: '/moods/weather/angry.png',
  anxious: '/moods/weather/anxious.png',
  sick: '/moods/weather/sick.png',
};

/** muhammad atho' · Ghost pack — 정적 PNG */
const GHOST_ICONS: Record<Mood, string> = {
  happy: '/moods/ghost/happy.png',
  excited: '/moods/ghost/excited.png',
  love: '/moods/ghost/love.png',
  proud: '/moods/ghost/proud.png',
  calm: '/moods/ghost/calm.png',
  sleepy: '/moods/ghost/sleepy.png',
  soso: '/moods/ghost/soso.png',
  surprised: '/moods/ghost/surprised.png',
  sad: '/moods/ghost/sad.png',
  angry: '/moods/ghost/angry.png',
  anxious: '/moods/ghost/anxious.png',
  sick: '/moods/ghost/sick.png',
};

/** Md Tanvirul Haque · Numbers 0 to 100 — 기분과 매핑하지 않음 */
const NUMBER_ICONS: Record<NumberSticker, string> = {
  '10': '/moods/numbers/10.png',
  '20': '/moods/numbers/20.png',
  '30': '/moods/numbers/30.png',
  '40': '/moods/numbers/40.png',
  '50': '/moods/numbers/50.png',
  '60': '/moods/numbers/60.png',
  '70': '/moods/numbers/70.png',
  '80': '/moods/numbers/80.png',
  '90': '/moods/numbers/90.png',
  '100': '/moods/numbers/100.png',
};

/** Md Tanvirul Haque · number 10 / 20 스타일 — 기분과 매핑하지 않음 */
const NUMBER2_ICONS: Record<NumberSticker, string> = {
  '10': '/moods/numbers2/10.png',
  '20': '/moods/numbers2/20.png',
  '30': '/moods/numbers2/30.png',
  '40': '/moods/numbers2/40.png',
  '50': '/moods/numbers2/50.png',
  '60': '/moods/numbers2/60.png',
  '70': '/moods/numbers2/70.png',
  '80': '/moods/numbers2/80.png',
  '90': '/moods/numbers2/90.png',
  '100': '/moods/numbers2/100.png',
};

export function isNumberPack(packId: MoodPackId): boolean {
  return packId === 'numbers' || packId === 'numbers2';
}

export const MOOD_PACKS: {
  id: MoodPackId;
  preview: DiarySticker[];
  icons?: Partial<Record<DiarySticker, string>>;
  attribution?: { author: string; href: string };
}[] = [
  {
    id: 'classic',
    preview: ['happy', 'love', 'sleepy', 'sad'],
    icons: CLASSIC_ICONS,
    attribution: {
      author: 'Magnific',
      href: 'https://www.flaticon.com/packs/emoji-6',
    },
  },
  {
    id: 'smileys',
    preview: ['happy', 'love', 'sleepy', 'sad'],
    icons: SMILEYS_ICONS,
    attribution: {
      author: 'Freepik',
      href: 'https://www.flaticon.com/free-animated-icons/emoji',
    },
  },
  {
    id: 'cat',
    preview: ['happy', 'love', 'sleepy', 'sad'],
    icons: CAT_ICONS,
    attribution: {
      author: 'MrHamster',
      href: 'https://www.flaticon.com/packs/cat-emojis',
    },
  },
  {
    id: 'dog',
    preview: ['happy', 'love', 'sleepy', 'sad'],
    icons: DOG_ICONS,
    attribution: {
      author: 'MrHamster',
      href: 'https://www.flaticon.com/packs/dog-emojis',
    },
  },
  {
    id: 'love',
    preview: ['happy', 'love', 'sleepy', 'sad'],
    icons: LOVE_ICONS,
    attribution: {
      author: 'Rohim',
      href: 'https://www.flaticon.com/packs/love-emoticons-1',
    },
  },
  {
    id: 'ghost',
    preview: ['happy', 'love', 'sleepy', 'sad'],
    icons: GHOST_ICONS,
    attribution: {
      author: "muhammad atho'",
      href: 'https://www.flaticon.com/packs/ghost-8',
    },
  },
  {
    id: 'weather',
    preview: ['happy', 'soso', 'sad', 'angry'],
    icons: WEATHER_ICONS,
    attribution: {
      author: 'iconixar',
      href: 'https://www.flaticon.com/packs/weather-161',
    },
  },
  {
    id: 'numbers',
    preview: ['10', '30','50', '100'],
    icons: NUMBER_ICONS,
    attribution: {
      author: 'Md Tanvirul Haque',
      href: 'https://www.flaticon.com/packs/numbers-0-to-100',
    },
  },
  {
    id: 'numbers2',
    preview: ['10', '30','50', '100'],
    icons: NUMBER2_ICONS,
    attribution: {
      author: 'Md Tanvirul Haque',
      href: 'https://www.flaticon.com/free-icons/number-10',
    },
  },
];

/** 앱 정보 · 라이선스에 표시할 출처 목록 */
export const MOOD_ICON_CREDITS = MOOD_PACKS.filter((p) => p.attribution).map((p) => ({
  packId: p.id,
  ...p.attribution!,
}));

export function isValidMoodPackId(id: unknown): id is MoodPackId {
  return typeof id === 'string' && MOOD_PACKS.some((p) => p.id === id);
}

export function parseMoodPackId(id: unknown): MoodPackId | undefined {
  if (isValidMoodPackId(id)) return id;
  if (id === 'weatherAnimated' || id === 'weatherStatic') return 'weather';
  return undefined;
}

export function getStoredMoodPackId(): MoodPackId {
  try {
    return parseMoodPackId(localStorage.getItem(MOOD_PACK_STORAGE_KEY)) ?? 'smileys';
  } catch {
    return 'smileys';
  }
}

export function defaultStickerForPack(packId: MoodPackId): DiarySticker {
  return isNumberPack(packId) ? NUMBER_STICKERS[0] : 'happy';
}

/** 일기에 저장된 팩. 없으면 현재 선택 팩(기존 일기 마이그레이션 전) */
export function entryMoodPack(entry: { moodPack?: string } | null | undefined): MoodPackId {
  return parseMoodPackId(entry?.moodPack) ?? getStoredMoodPackId();
}

export function applyMoodPack(id: MoodPackId) {
  try {
    localStorage.setItem(MOOD_PACK_STORAGE_KEY, id);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(MOOD_PACK_CHANGE_EVENT));
}

export function applyStoredMoodPack() {
  applyMoodPack(getStoredMoodPackId());
}

export function getMoodPack(id: MoodPackId = getStoredMoodPackId()) {
  return MOOD_PACKS.find((p) => p.id === id) ?? MOOD_PACKS[0];
}

/** 숫자 스티커는 해당 숫자 팩 아이콘. 기분은 해당 팩 아이콘 */
export function getMoodVisual(sticker: DiarySticker, packId: MoodPackId = getStoredMoodPackId()) {
  if (isNumberSticker(sticker)) {
    const icons = packId === 'numbers2' ? NUMBER2_ICONS : NUMBER_ICONS;
    return {
      emoji: sticker,
      label: sticker,
      icon: icons[sticker],
    };
  }
  const base = MOODS.find((m) => m.value === sticker);
  if (isNumberPack(packId)) {
    return {
      emoji: base?.emoji ?? '☺️',
      label: base?.label ?? sticker,
      icon: undefined,
    };
  }
  const pack = getMoodPack(packId);
  const icon = pack.icons?.[sticker];
  return {
    emoji: base?.emoji ?? '☺️',
    label: base?.label ?? sticker,
    icon,
  };
}

export function getMoodIconTransform(sticker: DiarySticker, packId: MoodPackId) {
  if (!isMood(sticker)) return undefined;
  return MOOD_ICON_TRANSFORMS[packId]?.[sticker];
}

function subscribeMoodPack(onStoreChange: () => void) {
  window.addEventListener(MOOD_PACK_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(MOOD_PACK_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function useMoodPackId(): MoodPackId {
  return useSyncExternalStore(subscribeMoodPack, getStoredMoodPackId, () => 'smileys' as MoodPackId);
}
