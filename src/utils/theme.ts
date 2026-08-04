export type ThemeId = 'paper' | 'matcha' | 'sky' | 'blossom' | 'ink' | 'lemon';

export const THEME_STORAGE_KEY = 'picture-diary-theme';

export const THEMES: { id: ThemeId; swatch: string[] }[] = [
  { id: 'paper', swatch: ['#fff9f5', '#e8a07a', '#ffdcc8'] },
  { id: 'matcha', swatch: ['#f5fbf7', '#7cb89a', '#d8f5e8'] },
  { id: 'sky', swatch: ['#f5f8fc', '#8bb0d4', '#dceaf6'] },
  { id: 'blossom', swatch: ['#fbf6fa', '#c9a0d4', '#dccfff'] },
  { id: 'ink', swatch: ['#f7f6f4', '#8a8580', '#ebe8e4'] },
  { id: 'lemon', swatch: ['#fffaf0', '#e0b85a', '#f5e8c4'] },
];

const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

export function getStoredThemeId(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && THEME_IDS.has(raw)) return raw as ThemeId;
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
