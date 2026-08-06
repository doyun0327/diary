import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import zh from './locales/zh.json';
import id from './locales/id.json';
import ja from './locales/ja.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import th from './locales/th.json';
import vi from './locales/vi.json';
import fr from './locales/fr.json';

export const LANG_STORAGE_KEY = 'picture-diary-lang';

export const APP_LANGUAGES = [
  'ko',
  'en',
  'zh',
  'id',
  'ja',
  'vi',
  'fr',
  'pt',
  'es',
  'th',
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

const LANGS = new Set<string>(APP_LANGUAGES);

export function getStoredLanguage(): AppLanguage {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw && LANGS.has(raw)) return raw as AppLanguage;
  } catch {
    // ignore
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ko';
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('id')) return 'id';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('vi')) return 'vi';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('th')) return 'th';
  if (nav.startsWith('ko')) return 'ko';
  return 'en';
}

export function setStoredLanguage(lang: AppLanguage) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
}

void i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    zh: { translation: zh },
    id: { translation: id },
    ja: { translation: ja },
    es: { translation: es },
    pt: { translation: pt },
    th: { translation: th },
    vi: { translation: vi },
    fr: { translation: fr },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

setStoredLanguage(getStoredLanguage());

export default i18n;
