import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import zh from './locales/zh.json';
import zhTW from './locales/zh-TW.json';
import id from './locales/id.json';
import ja from './locales/ja.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import th from './locales/th.json';
import vi from './locales/vi.json';
import fr from './locales/fr.json';
import de from './locales/de.json';

export const LANG_STORAGE_KEY = 'picture-diary-lang';

/** zh-TW는 zh보다 먼저 — zh-tw 감지 시 간체(zh)로 오인하지 않도록 */
export const APP_LANGUAGES = [
  'ko',
  'en',
  'zh-TW',
  'zh',
  'id',
  'ja',
  'vi',
  'fr',
  'de',
  'pt',
  'es',
  'th',
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

const LANGS = new Set<string>(APP_LANGUAGES);

function navLanguage(): string {
  return typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ko';
}

function detectChineseVariant(nav: string): 'zh-TW' | 'zh' | null {
  if (
    nav.startsWith('zh-tw') ||
    nav.startsWith('zh-hk') ||
    nav.startsWith('zh-mo') ||
    nav.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }
  if (nav.startsWith('zh')) return 'zh';
  return null;
}

export function getStoredLanguage(): AppLanguage {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw && LANGS.has(raw)) return raw as AppLanguage;
  } catch {
    // ignore
  }
  const nav = navLanguage();
  const zh = detectChineseVariant(nav);
  if (zh) return zh;
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('id')) return 'id';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('vi')) return 'vi';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('th')) return 'th';
  if (nav.startsWith('ko')) return 'ko';
  return 'en';
}

export function resolveAppLanguage(lng?: string | null): AppLanguage {
  const raw = (lng ?? getStoredLanguage()).toLowerCase();
  for (const lang of APP_LANGUAGES) {
    const code = lang.toLowerCase();
    if (raw === code || raw.startsWith(`${code}-`)) return lang;
  }
  const zh = detectChineseVariant(raw);
  if (zh) return zh;
  return getStoredLanguage();
}

export function setStoredLanguage(lang: AppLanguage) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  document.documentElement.lang =
    lang === 'pt'
      ? 'pt-BR'
      : lang === 'zh-TW'
        ? 'zh-Hant'
        : lang === 'zh'
          ? 'zh-Hans'
          : lang;
}

void i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    zh: { translation: zh },
    'zh-TW': { translation: zhTW },
    id: { translation: id },
    ja: { translation: ja },
    es: { translation: es },
    pt: { translation: pt },
    th: { translation: th },
    vi: { translation: vi },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

setStoredLanguage(getStoredLanguage());

export default i18n;
