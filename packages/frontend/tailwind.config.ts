import { CATEGORY_PALETTE } from './src/lib/categoryColors';

// Eine Quelle für die kategoriale Skala: die Utilities cat-1…8 entstehen
// aus derselben Liste, die auch pickCategoryColor() benutzt. Vorher lagen
// die Hex-Werte doppelt vor und liefen auseinander.
const categoryColors = Object.fromEntries(
  CATEGORY_PALETTE.map((hex, i) => [`cat-${i + 1}`, hex]),
);

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand
        indigo: { DEFAULT: '#37415c', soft: '#5e6a8c' },
        navy: '#181a2f',
        peach: { DEFAULT: '#fda481', light: '#fec9b2', press: '#fc8b60' },

        // Primärakzent
        violet: 'var(--violet)',
        azure: 'var(--azure)',

        // Semantic surfaces (CSS-var-driven for dark mode)
        bg: 'var(--bg)',
        elev: 'var(--bg-elev)',
        sunken: 'var(--bg-sunken)',
        soft: 'var(--bg-soft)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',

        // Text scale
        ink: 'var(--text)',
        'ink-2': 'var(--text-2)',
        'ink-3': 'var(--text-3)',
        'ink-4': 'var(--text-4)',

        // Status
        pos: 'var(--pos)',
        'pos-bg': 'var(--pos-bg)',
        neg: 'var(--neg)',
        'neg-bg': 'var(--neg-bg)',
        warn: 'var(--warn)',
        'warn-bg': 'var(--warn-bg)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        idle: 'var(--idle)',
        'idle-bg': 'var(--idle-bg)',

        // Kategoriale Skala (aus lib/categoryColors.ts)
        ...categoryColors,
      },
      backgroundImage: {
        'grad-brand': 'var(--grad-brand)',
        'grad-brand-90': 'var(--grad-brand-90)',
        'grad-hero': 'var(--grad-hero)',
        'grad-soft': 'var(--grad-soft)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      borderRadius: {
        md: '12px',
        lg: '16px',
        xl: '22px',
        pill: '999px',
      },
      boxShadow: {
        sm: 'var(--shadow-1)',
        md: 'var(--shadow-2)',
        btn: 'var(--shadow-btn)',
        overlay: 'var(--shadow-overlay)',
        tooltip: 'var(--shadow-tooltip)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        // Overlays (Palette, Inbox) und der blinkende Eingabecursor
        'o-fade': 'oFade 190ms ease-out',
        'o-pulse': 'oPulse 1.2s ease-in-out infinite',
      },
      keyframes: {
        oFade: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        oPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.45' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
