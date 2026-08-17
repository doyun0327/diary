import { useSyncExternalStore } from 'react';
import type { Mood } from '../types/diary';
import { MOODS } from '../types/diary';

export type MoodPackId = 'classic' | 'smileys' | 'cat' | 'dog' | 'love' | 'ghost';

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

export const MOOD_PACKS: {
  id: MoodPackId;
  preview: Mood[];
  icons?: Partial<Record<Mood, string>>;
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
];

/** 앱 정보 · 라이선스에 표시할 출처 목록 */
export const MOOD_ICON_CREDITS = MOOD_PACKS.filter((p) => p.attribution).map((p) => ({
  packId: p.id,
  ...p.attribution!,
}));

export function getStoredMoodPackId(): MoodPackId {
  try {
    const raw = localStorage.getItem(MOOD_PACK_STORAGE_KEY);
    if (
      raw === 'classic' ||
      raw === 'smileys' ||
      raw === 'cat' ||
      raw === 'dog' ||
      raw === 'love' ||
      raw === 'ghost'
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'smileys';
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

/** 현재 팩 기준 표시용: 아이콘 URL 또는 유니코드 이모지 */
export function getMoodVisual(mood: Mood, packId: MoodPackId = getStoredMoodPackId()) {
  const base = MOODS.find((m) => m.value === mood);
  const pack = getMoodPack(packId);
  const icon = pack.icons?.[mood];
  return {
    emoji: base?.emoji ?? '☺️',
    label: base?.label ?? mood,
    icon,
  };
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
