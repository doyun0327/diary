export type ThemeId = 'paper' | 'matcha';

export const THEME_STORAGE_KEY = 'picture-diary-theme';

/** 선택 가능한 테마 (나중에 sky/blossom/ink 추가) */
export const THEMES: { id: ThemeId; swatch: string[] }[] = [
  { id: 'paper', swatch: ['#faf8f4', '#c47a3a', '#e8e2d8'] },
  { id: 'matcha', swatch: ['#f2f6f1', '#6b8f6a', '#d5e0d4'] },
];

export function getStoredThemeId(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'matcha') return 'matcha';
  } catch {
    // ignore
  }
  return 'paper';
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === 'paper') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', id);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function applyStoredTheme() {
  applyTheme(getStoredThemeId());
}
