import { getStoredLanguage, type AppLanguage } from '../i18n';

export interface FontOption {
  id: string;
  /** 사용자에게 보여줄 이름 */
  label: string;
  /** CSS font-family 값 */
  family: string;
  category: 'cute' | 'neat';
  langs: AppLanguage[];
}

const LATIN: AppLanguage[] = ['en', 'es', 'fr', 'de', 'pt', 'id'];
const LATIN_VI: AppLanguage[] = [...LATIN, 'vi'];

export const FONTS: FontOption[] = [
  // 한국어
  { id: 'gaegu', label: '개구', family: "'Gaegu', cursive", category: 'cute', langs: ['ko'] },
  { id: 'dongle', label: '동글', family: "'Dongle', sans-serif", category: 'cute', langs: ['ko'] },
  { id: 'hi-melody', label: '히멜로디', family: "'Hi Melody', cursive", category: 'cute', langs: ['ko'] },
  { id: 'single-day', label: '싱글데이', family: "'Single Day', cursive", category: 'cute', langs: ['ko'] },
  { id: 'cute-font', label: '큐트폰트', family: "'Cute Font', cursive", category: 'cute', langs: ['ko'] },
  { id: 'jua', label: '주아', family: "'Jua', sans-serif", category: 'cute', langs: ['ko'] },
  { id: 'gamja-flower', label: '감자꽃', family: "'Gamja Flower', cursive", category: 'cute', langs: ['ko'] },
  { id: 'poor-story', label: '푸어스토리', family: "'Poor Story', cursive", category: 'cute', langs: ['ko'] },
  {
    id: 'nanum-pen',
    label: '나눔손글씨 펜',
    family: "'Nanum Pen Script', cursive",
    category: 'cute',
    langs: ['ko'],
  },
  {
    id: 'nanum-brush',
    label: '나눔손글씨 붓',
    family: "'Nanum Brush Script', cursive",
    category: 'cute',
    langs: ['ko'],
  },
  {
    id: 'east-sea-dokdo',
    label: '동해독도',
    family: "'East Sea Dokdo', cursive",
    category: 'cute',
    langs: ['ko'],
  },
  { id: 'yeon-sung', label: '연성', family: "'Yeon Sung', cursive", category: 'cute', langs: ['ko'] },
  {
    id: 'noto-sans',
    label: '노토 산스',
    family: "'Noto Sans KR', sans-serif",
    category: 'neat',
    langs: ['ko'],
  },
  {
    id: 'nanum-gothic',
    label: '나눔고딕',
    family: "'Nanum Gothic', sans-serif",
    category: 'neat',
    langs: ['ko'],
  },
  {
    id: 'gowun-dodum',
    label: '고운돋움',
    family: "'Gowun Dodum', sans-serif",
    category: 'neat',
    langs: ['ko'],
  },
  {
    id: 'gowun-batang',
    label: '고운바탕',
    family: "'Gowun Batang', serif",
    category: 'neat',
    langs: ['ko'],
  },
  {
    id: 'nanum-myeongjo',
    label: '나눔명조',
    family: "'Nanum Myeongjo', serif",
    category: 'neat',
    langs: ['ko'],
  },
  { id: 'song-myung', label: '송명', family: "'Song Myung', serif", category: 'neat', langs: ['ko'] },
  { id: 'do-hyeon', label: '도현', family: "'Do Hyeon', sans-serif", category: 'neat', langs: ['ko'] },
  {
    id: 'ibm-plex',
    label: 'IBM 플렉스',
    family: "'IBM Plex Sans KR', sans-serif",
    category: 'neat',
    langs: ['ko'],
  },

  // 라틴 (영·스·프·포·인니)
  { id: 'caveat', label: 'Caveat', family: "'Caveat', cursive", category: 'cute', langs: LATIN },
  {
    id: 'patrick-hand',
    label: 'Patrick Hand',
    family: "'Patrick Hand', cursive",
    category: 'cute',
    langs: LATIN,
  },
  {
    id: 'indie-flower',
    label: 'Indie Flower',
    family: "'Indie Flower', cursive",
    category: 'cute',
    langs: LATIN,
  },
  {
    id: 'dancing-script',
    label: 'Dancing Script',
    family: "'Dancing Script', cursive",
    category: 'cute',
    langs: LATIN_VI,
  },
  {
    id: 'shadows-into-light',
    label: 'Shadows Into Light',
    family: "'Shadows Into Light', cursive",
    category: 'cute',
    langs: LATIN,
  },
  {
    id: 'pacifico',
    label: 'Pacifico',
    family: "'Pacifico', cursive",
    category: 'cute',
    langs: LATIN_VI,
  },
  { id: 'nunito', label: 'Nunito', family: "'Nunito', sans-serif", category: 'neat', langs: LATIN_VI },
  { id: 'lora', label: 'Lora', family: "'Lora', serif", category: 'neat', langs: LATIN_VI },
  {
    id: 'libre-baskerville',
    label: 'Libre Baskerville',
    family: "'Libre Baskerville', serif",
    category: 'neat',
    langs: LATIN,
  },
  { id: 'karla', label: 'Karla', family: "'Karla', sans-serif", category: 'neat', langs: LATIN },
  {
    id: 'source-serif',
    label: 'Source Serif',
    family: "'Source Serif 4', serif",
    category: 'neat',
    langs: LATIN_VI,
  },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    family: "'IBM Plex Sans', sans-serif",
    category: 'neat',
    langs: LATIN_VI,
  },

  // 베트남어
  {
    id: 'great-vibes',
    label: 'Great Vibes',
    family: "'Great Vibes', cursive",
    category: 'cute',
    langs: ['vi'],
  },
  {
    id: 'be-vietnam-pro',
    label: 'Be Vietnam Pro',
    family: "'Be Vietnam Pro', sans-serif",
    category: 'neat',
    langs: ['vi'],
  },

  // 일본어
  { id: 'yomogi', label: 'Yomogi', family: "'Yomogi', cursive", category: 'cute', langs: ['ja'] },
  {
    id: 'hachi-maru-pop',
    label: 'Hachi Maru Pop',
    family: "'Hachi Maru Pop', cursive",
    category: 'cute',
    langs: ['ja'],
  },
  {
    id: 'zen-kurenaido',
    label: 'Zen Kurenaido',
    family: "'Zen Kurenaido', sans-serif",
    category: 'cute',
    langs: ['ja'],
  },
  {
    id: 'yusei-magic',
    label: 'Yusei Magic',
    family: "'Yusei Magic', sans-serif",
    category: 'cute',
    langs: ['ja'],
  },
  {
    id: 'kiwi-maru',
    label: 'Kiwi Maru',
    family: "'Kiwi Maru', serif",
    category: 'cute',
    langs: ['ja'],
  },
  {
    id: 'noto-sans-jp',
    label: 'Noto Sans JP',
    family: "'Noto Sans JP', sans-serif",
    category: 'neat',
    langs: ['ja'],
  },
  {
    id: 'zen-maru-gothic',
    label: 'Zen Maru Gothic',
    family: "'Zen Maru Gothic', sans-serif",
    category: 'neat',
    langs: ['ja'],
  },
  {
    id: 'mplus-rounded',
    label: 'M PLUS Rounded',
    family: "'M PLUS Rounded 1c', sans-serif",
    category: 'neat',
    langs: ['ja'],
  },
  {
    id: 'kosugi-maru',
    label: 'Kosugi Maru',
    family: "'Kosugi Maru', sans-serif",
    category: 'neat',
    langs: ['ja'],
  },
  {
    id: 'noto-serif-jp',
    label: 'Noto Serif JP',
    family: "'Noto Serif JP', serif",
    category: 'neat',
    langs: ['ja'],
  },
  {
    id: 'shippori-mincho',
    label: 'Shippori Mincho',
    family: "'Shippori Mincho', serif",
    category: 'neat',
    langs: ['ja'],
  },

  // 중국어
  {
    id: 'zcool-kuaile',
    label: '站酷快乐体',
    family: "'ZCOOL KuaiLe', sans-serif",
    category: 'cute',
    langs: ['zh'],
  },
  {
    id: 'ma-shan-zheng',
    label: '马善政楷书',
    family: "'Ma Shan Zheng', cursive",
    category: 'cute',
    langs: ['zh', 'zh-TW'],
  },
  {
    id: 'liu-jian-mao-cao',
    label: '刘建毛草',
    family: "'Liu Jian Mao Cao', cursive",
    category: 'cute',
    langs: ['zh', 'zh-TW'],
  },
  {
    id: 'long-cang',
    label: '龙藏',
    family: "'Long Cang', cursive",
    category: 'cute',
    langs: ['zh', 'zh-TW'],
  },
  {
    id: 'zhi-mang-xing',
    label: '芝麻体',
    family: "'Zhi Mang Xing', cursive",
    category: 'cute',
    langs: ['zh', 'zh-TW'],
  },
  {
    id: 'noto-sans-sc',
    label: 'Noto Sans SC',
    family: "'Noto Sans SC', sans-serif",
    category: 'neat',
    langs: ['zh'],
  },
  {
    id: 'zcool-xiaowei',
    label: '站酷小薇',
    family: "'ZCOOL XiaoWei', serif",
    category: 'neat',
    langs: ['zh'],
  },
  {
    id: 'zcool-qingke',
    label: '站酷庆科',
    family: "'ZCOOL QingKe HuangYou', sans-serif",
    category: 'neat',
    langs: ['zh'],
  },
  {
    id: 'noto-serif-sc',
    label: 'Noto Serif SC',
    family: "'Noto Serif SC', serif",
    category: 'neat',
    langs: ['zh'],
  },

  // 繁體中文
  {
    id: 'lxgw-wenkai-tc',
    label: '霞鶩文楷',
    family: "'LXGW WenKai TC', serif",
    category: 'cute',
    langs: ['zh-TW'],
  },
  {
    id: 'noto-sans-tc',
    label: 'Noto Sans TC',
    family: "'Noto Sans TC', sans-serif",
    category: 'neat',
    langs: ['zh-TW'],
  },
  {
    id: 'noto-serif-tc',
    label: 'Noto Serif TC',
    family: "'Noto Serif TC', serif",
    category: 'neat',
    langs: ['zh-TW'],
  },

  // 태국어
  { id: 'charm', label: 'Charm', family: "'Charm', cursive", category: 'cute', langs: ['th'] },
  {
    id: 'charmonman',
    label: 'Charmonman',
    family: "'Charmonman', cursive",
    category: 'cute',
    langs: ['th'],
  },
  { id: 'sriracha', label: 'Sriracha', family: "'Sriracha', cursive", category: 'cute', langs: ['th'] },
  { id: 'mali', label: 'Mali', family: "'Mali', cursive", category: 'cute', langs: ['th'] },
  { id: 'pattaya', label: 'Pattaya', family: "'Pattaya', cursive", category: 'cute', langs: ['th'] },
  {
    id: 'noto-sans-thai',
    label: 'Noto Sans Thai',
    family: "'Noto Sans Thai', sans-serif",
    category: 'neat',
    langs: ['th'],
  },
  { id: 'sarabun', label: 'Sarabun', family: "'Sarabun', sans-serif", category: 'neat', langs: ['th'] },
  { id: 'prompt', label: 'Prompt', family: "'Prompt', sans-serif", category: 'neat', langs: ['th'] },
  { id: 'kanit', label: 'Kanit', family: "'Kanit', sans-serif", category: 'neat', langs: ['th'] },
  {
    id: 'ibm-plex-thai',
    label: 'IBM Plex Thai',
    family: "'IBM Plex Sans Thai', sans-serif",
    category: 'neat',
    langs: ['th'],
  },
];

const LANG_DEFAULT_FONT: Record<AppLanguage, string> = {
  ko: 'gaegu',
  en: 'caveat',
  es: 'caveat',
  fr: 'caveat',
  de: 'caveat',
  pt: 'caveat',
  id: 'caveat',
  vi: 'be-vietnam-pro',
  ja: 'yomogi',
  zh: 'zcool-kuaile',
  'zh-TW': 'lxgw-wenkai-tc',
  th: 'charm',
};

const LANG_GOOGLE_FONTS: Partial<Record<AppLanguage, string>> = {
  en: [
    'family=Caveat:wght@400;700',
    'family=Patrick+Hand',
    'family=Indie+Flower',
    'family=Dancing+Script:wght@400;700',
    'family=Shadows+Into+Light',
    'family=Pacifico',
    'family=Lora:wght@400;700',
    'family=Libre+Baskerville:wght@400;700',
    'family=Karla:wght@400;700',
    'family=Source+Serif+4:wght@400;700',
    'family=IBM+Plex+Sans:wght@400;700',
  ].join('&'),
  ja: [
    'family=Yomogi',
    'family=Hachi+Maru+Pop',
    'family=Zen+Kurenaido',
    'family=Yusei+Magic',
    'family=Kiwi+Maru',
    'family=Zen+Maru+Gothic:wght@400;700',
    'family=M+PLUS+Rounded+1c:wght@400;700',
    'family=Kosugi+Maru',
    'family=Noto+Sans+JP:wght@400;700',
    'family=Noto+Serif+JP:wght@400;700',
    'family=Shippori+Mincho:wght@400;700',
  ].join('&'),
  zh: [
    'family=ZCOOL+KuaiLe',
    'family=Ma+Shan+Zheng',
    'family=Liu+Jian+Mao+Cao',
    'family=Long+Cang',
    'family=Zhi+Mang+Xing',
    'family=ZCOOL+XiaoWei',
    'family=ZCOOL+QingKe+HuangYou',
    'family=Noto+Sans+SC:wght@400;700',
    'family=Noto+Serif+SC:wght@400;700',
  ].join('&'),
  'zh-TW': [
    'family=LXGW+WenKai+TC',
    'family=Ma+Shan+Zheng',
    'family=Liu+Jian+Mao+Cao',
    'family=Long+Cang',
    'family=Zhi+Mang+Xing',
    'family=Noto+Sans+TC:wght@400;700',
    'family=Noto+Serif+TC:wght@400;700',
  ].join('&'),
  th: [
    'family=Charm:wght@400;700',
    'family=Charmonman',
    'family=Sriracha',
    'family=Mali:wght@400;700',
    'family=Pattaya',
    'family=Noto+Sans+Thai:wght@400;700',
    'family=Sarabun:wght@400;700',
    'family=Prompt:wght@400;700',
    'family=Kanit:wght@400;700',
    'family=IBM+Plex+Sans+Thai:wght@400;700',
  ].join('&'),
  vi: [
    'family=Dancing+Script:wght@400;700',
    'family=Pacifico',
    'family=Great+Vibes',
    'family=Be+Vietnam+Pro:wght@400;700',
    'family=Lora:wght@400;700',
    'family=Source+Serif+4:wght@400;700',
    'family=IBM+Plex+Sans:wght@400;700',
  ].join('&'),
};

LANG_GOOGLE_FONTS.es = LANG_GOOGLE_FONTS.en;
LANG_GOOGLE_FONTS.fr = LANG_GOOGLE_FONTS.en;
LANG_GOOGLE_FONTS.de = LANG_GOOGLE_FONTS.en;
LANG_GOOGLE_FONTS.pt = LANG_GOOGLE_FONTS.en;
LANG_GOOGLE_FONTS.id = LANG_GOOGLE_FONTS.en;

export const DEFAULT_FONT_ID = 'gaegu';

/** 한·중·일·태·라틴 등 선택한 손글씨에 없는 글자용 */
export const DIARY_FONT_FALLBACKS =
  "'Noto Sans KR', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Thai', 'Noto Sans', sans-serif";

export function diaryFontStack(primaryFamily: string): string {
  const primary = primaryFamily
    .split(',')
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        part !== 'cursive' &&
        part !== 'sans-serif' &&
        part !== 'serif' &&
        !DIARY_FONT_FALLBACKS.includes(part),
    )
    .join(', ');
  return primary ? `${primary}, ${DIARY_FONT_FALLBACKS}` : DIARY_FONT_FALLBACKS;
}

export function fontsForLanguage(lang: AppLanguage = getStoredLanguage()): FontOption[] {
  return FONTS.filter((f) => f.langs.includes(lang));
}

export function defaultFontIdForLanguage(lang: AppLanguage = getStoredLanguage()): string {
  return LANG_DEFAULT_FONT[lang] ?? DEFAULT_FONT_ID;
}

export function loadLanguageFonts(lang: AppLanguage = getStoredLanguage()) {
  const query = LANG_GOOGLE_FONTS[lang];
  if (!query || typeof document === 'undefined') return;
  const id = `diary-lang-fonts-${lang}`;
  if (document.getElementById(id)) return;
  const el = document.createElement('link');
  el.id = id;
  el.rel = 'stylesheet';
  el.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  document.head.appendChild(el);
}

/** 새 일기 기본 글씨체 (언어별) */
export const FONT_PREFERENCE_KEY = 'picture-diary-font';

export function findFont(id: string | undefined | null): FontOption {
  const fallback =
    FONTS.find((f) => f.id === defaultFontIdForLanguage()) ?? FONTS[0];
  const font = (id && FONTS.find((f) => f.id === id)) || fallback;
  loadLanguageFonts(font.langs[0]);
  return font;
}

export function getPreferredFontId(lang: AppLanguage = getStoredLanguage()): string {
  const available = fontsForLanguage(lang);
  try {
    const keyed = localStorage.getItem(`${FONT_PREFERENCE_KEY}-${lang}`);
    if (keyed && available.some((f) => f.id === keyed)) return keyed;
    if (lang === 'ko') {
      const legacy = localStorage.getItem(FONT_PREFERENCE_KEY);
      if (legacy && available.some((f) => f.id === legacy)) return legacy;
    }
  } catch {
    // ignore
  }
  return defaultFontIdForLanguage(lang);
}

export function setPreferredFontId(id: string, lang: AppLanguage = getStoredLanguage()) {
  try {
    localStorage.setItem(`${FONT_PREFERENCE_KEY}-${lang}`, id);
  } catch {
    // ignore
  }
}

export const FONT_SIZE_IDS = ['sm', 'md', 'lg', 'xl'] as const;
export type FontSizeId = (typeof FONT_SIZE_IDS)[number];
export const DEFAULT_FONT_SIZE_ID: FontSizeId = 'md';
export const FONT_SIZE_PREFERENCE_KEY = 'picture-diary-font-size';

export const FONT_SIZE_REMS: Record<FontSizeId, string> = {
  sm: '1rem',
  md: '1.2rem',
  lg: '1.42rem',
  xl: '1.68rem',
};

export function parseFontSizeId(id?: string | null): FontSizeId {
  if (id && (FONT_SIZE_IDS as readonly string[]).includes(id)) {
    return id as FontSizeId;
  }
  return DEFAULT_FONT_SIZE_ID;
}

export function fontSizeCss(id?: string | null): string {
  return FONT_SIZE_REMS[parseFontSizeId(id)];
}

export function getPreferredFontSizeId(): FontSizeId {
  try {
    return parseFontSizeId(localStorage.getItem(FONT_SIZE_PREFERENCE_KEY));
  } catch {
    return DEFAULT_FONT_SIZE_ID;
  }
}

export function setPreferredFontSizeId(id: FontSizeId) {
  try {
    localStorage.setItem(FONT_SIZE_PREFERENCE_KEY, id);
  } catch {
    // ignore
  }
}

export function applyDiaryFontSize(id?: string | null, target: HTMLElement = document.documentElement) {
  target.style.setProperty('--diary-font-size', fontSizeCss(id));
}

export function brandFontStack(lang: AppLanguage = getStoredLanguage()): string {
  return diaryFontStack(findFont(defaultFontIdForLanguage(lang)).family);
}

export function applyLanguageFonts(lang: AppLanguage = getStoredLanguage()) {
  loadLanguageFonts(lang);
  document.documentElement.style.setProperty('--brand-font', brandFontStack(lang));
  const font = findFont(getPreferredFontId(lang));
  document.documentElement.style.setProperty('--diary-font', diaryFontStack(font.family));
  applyDiaryFontSize(getPreferredFontSizeId());
}

/** 일기 엔트리에 저장된 글씨체 (구버전 일기는 기본값) */
export function fontFamilyForEntry(fontId?: string): string {
  return diaryFontStack(findFont(fontId).family);
}
