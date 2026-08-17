export type ThemeId = 'paper' | 'matcha' | 'sky' | 'blossom' | 'ink' | 'lemon';

export const THEME_STORAGE_KEY = 'picture-diary-theme';

export const THEMES: { id: ThemeId; swatch: string[] }[] = [
  { id: 'paper', swatch: ['#ffffff', '#2a2a2a', '#f0f0f0'] },
  { id: 'matcha', swatch: ['#f5fbf7', '#7cb89a', '#d8f5e8'] },
  { id: 'sky', swatch: ['#f5f8fc', '#8bb0d4', '#dceaf6'] },
  { id: 'blossom', swatch: ['#fbf6fa', '#c9a0d4', '#ebe3f7'] },
  { id: 'ink', swatch: ['#f7f6f4', '#8a8580', '#ebe8e4'] },
  { id: 'lemon', swatch: ['#fffaf0', '#e0b85a', '#f5e8c4'] },
];

const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

const THEME_ACCENTS: Record<ThemeId, { accent: string; background: string }> = {
  paper: { accent: '#2a2a2a', background: '#ffffff' },
  matcha: { accent: '#7cb89a', background: '#f5fbf7' },
  sky: { accent: '#8bb0d4', background: '#f5f8fc' },
  blossom: { accent: '#c9a0d4', background: '#fbf6fa' },
  ink: { accent: '#8a8580', background: '#f7f6f4' },
  lemon: { accent: '#e0b85a', background: '#fffaf0' },
};

export function getStoredThemeId(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && THEME_IDS.has(raw)) return raw as ThemeId;
  } catch {
    // ignore
  }
  return 'paper';
}

function syncThemeToNative(id: ThemeId) {
  if (typeof window === 'undefined') return;
  const native = (window as Window & {
    DiaryNative?: { postMessage: (message: string) => void };
  }).DiaryNative;
  if (!native?.postMessage) return;

  const colors = THEME_ACCENTS[id] ?? THEME_ACCENTS.paper;
  native.postMessage(
    JSON.stringify({
      type: 'theme',
      themeId: id,
      accent: colors.accent,
      background: colors.background,
    }),
  );
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

  syncThemeToNative(id);
}

export function applyStoredTheme() {
  applyTheme(getStoredThemeId());
}
