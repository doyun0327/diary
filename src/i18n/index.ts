import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

export const LANG_STORAGE_KEY = 'picture-diary-lang';
export type AppLanguage = 'ko' | 'en';

export function getStoredLanguage(): AppLanguage {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw === 'en' || raw === 'ko') return raw;
  } catch {
    // ignore
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'ko';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'ko';
}

export function setStoredLanguage(lang: AppLanguage) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  document.documentElement.lang = lang === 'en' ? 'en' : 'ko';
}

void i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

setStoredLanguage(getStoredLanguage());

export default i18n;
