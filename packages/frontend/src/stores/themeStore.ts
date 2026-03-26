import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggle: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        applyTheme(next);
      },
    }),
    { name: 'orynthia-theme' },
  ),
);

function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }
}

// Apply on load
const stored = localStorage.getItem('orynthia-theme');
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    applyTheme(parsed?.state?.theme || 'dark');
  } catch {
    applyTheme('dark');
  }
}
