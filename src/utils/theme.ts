export type ThemeId = 'paper' | 'matcha' | 'sky' | 'blossom' | 'ink' | 'lemon';

export const THEME_STORAGE_KEY = 'picture-diary-theme';

export const THEMES: { id: ThemeId; swatch: string[] }[] = [
  { id: 'paper', swatch: ['#faf8f4', '#c47a3a', '#e8e2d8'] },
  { id: 'matcha', swatch: ['#f2f6f1', '#6b8f6a', '#d5e0d4'] },
  { id: 'sky', swatch: ['#f3f7fb', '#5a8fb8', '#d5e2ef'] },
  { id: 'blossom', swatch: ['#fbf4f6', '#c4788a', '#edd9df'] },
  { id: 'ink', swatch: ['#f4f4f2', '#4a5560', '#d8d9d6'] },
  { id: 'lemon', swatch: ['#fbf9ef', '#c9a227', '#ebe4c8'] },
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
