import { create } from 'zustand';

type Theme = 'light' | 'dark';
const KEY = 'orynthia.theme';

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }
}

function detectInitial(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

const initial = detectInitial();
applyTheme(initial);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initial,
  toggle: () => get().set(get().theme === 'dark' ? 'light' : 'dark'),
  set: (theme) => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
}));
