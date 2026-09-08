import { MOOD_ICON_CREDITS } from './moodPack';

export type FlaticonCredit = {
  id: string;
  /** i18n key under appInfo.licenses.usage.* */
  usageKey: string;
  author: string;
  href: string;
};

/** 기분 아이콘 팩 (moodPack attribution) */
export const MOOD_FLATICON_CREDITS: FlaticonCredit[] = MOOD_ICON_CREDITS.map((c) => ({
  id: `mood-${c.packId}`,
  usageKey: `mood.${c.packId}`,
  author: c.author,
  href: c.href,
}));

/**
 * 캐릭터 헤어 · 캔버스 일러스트 스티커.
 * Flaticon 다운로드 시 표시된 작가명·팩 URL로 맞춰 주세요.
 */
export const EXTRA_FLATICON_CREDITS: FlaticonCredit[] = [
  {
    id: 'character-hair',
    usageKey: 'hair',
    author: 'Freepik',
    href: 'https://www.flaticon.com/free-icons/hairstyle',
  },
  {
    id: 'canvas-stickers',
    usageKey: 'stickers',
    author: 'Freepik',
    href: 'https://www.flaticon.com/free-icons/sticker',
  },
];

export const ALL_FLATICON_CREDITS: FlaticonCredit[] = [
  ...MOOD_FLATICON_CREDITS,
  ...EXTRA_FLATICON_CREDITS,
];
