import ko from './fortune/ko.json';
import en from './fortune/en.json';
import ja from './fortune/ja.json';
import zh from './fortune/zh.json';
import zhTW from './fortune/zh-TW.json';
import id from './fortune/id.json';
import vi from './fortune/vi.json';
import fr from './fortune/fr.json';
import de from './fortune/de.json';
import pt from './fortune/pt.json';
import es from './fortune/es.json';
import th from './fortune/th.json';

export type FortuneLang =
  | 'ko'
  | 'en'
  | 'ja'
  | 'zh'
  | 'zh-TW'
  | 'id'
  | 'vi'
  | 'fr'
  | 'de'
  | 'pt'
  | 'es'
  | 'th';

/** Static fortune-cookie lines. Not from diary content. */
export const FORTUNE_MESSAGES: Record<FortuneLang, readonly string[]> = {
  ko: ko as string[],
  en: en as string[],
  ja: ja as string[],
  zh: zh as string[],
  'zh-TW': zhTW as string[],
  id: id as string[],
  vi: vi as string[],
  fr: fr as string[],
  de: de as string[],
  pt: pt as string[],
  es: es as string[],
  th: th as string[],
};

export const FORTUNE_COUNT = FORTUNE_MESSAGES.ko.length;

function resolveFortuneLang(lang?: string | null): FortuneLang {
  const raw = (lang ?? 'ko').toLowerCase();
  if (raw.startsWith('zh-tw') || raw.startsWith('zh-hk') || raw.startsWith('zh-mo') || raw.startsWith('zh-hant')) {
    return 'zh-TW';
  }
  if (raw === 'zh-tw') return 'zh-TW';
  const base = raw.split('-')[0];
  if (base === 'zh') return 'zh';
  const known: FortuneLang[] = [
    'ko',
    'en',
    'ja',
    'id',
    'vi',
    'fr',
    'de',
    'pt',
    'es',
    'th',
  ];
  if ((known as string[]).includes(base)) return base as FortuneLang;
  return 'en';
}

export function fortuneMessagesFor(lang?: string | null): readonly string[] {
  const resolved = resolveFortuneLang(lang);
  const list = FORTUNE_MESSAGES[resolved];
  if (list && list.length >= FORTUNE_COUNT) return list;
  if (FORTUNE_MESSAGES.en.length >= FORTUNE_COUNT) return FORTUNE_MESSAGES.en;
  return FORTUNE_MESSAGES.ko;
}

export function pickFortuneMessage(lang?: string | null): string {
  const list = fortuneMessagesFor(lang);
  const n = list.length || FORTUNE_COUNT;
  const raw =
    list[Math.floor(Math.random() * n)] ?? list[0] ?? FORTUNE_MESSAGES.ko[0];
  // 번역 잔여 선행 쉼표 제거
  return String(raw ?? '').replace(/^[\s,，、]+/, '').trim() || String(raw ?? '');
}
