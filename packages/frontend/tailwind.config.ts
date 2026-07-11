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

        // Category swatches
        'cat-1': '#37415c',
        'cat-2': '#fda481',
        'cat-3': '#5b8def',
        'cat-4': '#1f8a5b',
        'cat-5': '#b97aff',
        'cat-6': '#e76b8d',
        'cat-7': '#3aa3a5',
        'cat-8': '#d99a2b',
      },
      backgroundImage: {
        'grad-brand': 'linear-gradient(135deg, #37415c, #fda481)',
        'grad-brand-90': 'linear-gradient(90deg,  #37415c, #fda481)',
        'grad-hero': 'linear-gradient(135deg, #181a2f 0%, #37415c 65%, #fda481 110%)',
        'grad-soft': 'linear-gradient(135deg, #f3f0fb 0%, #fff1e3 100%)',
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
        sm: '0 1px 0 rgba(24,26,47,.04), 0 6px 18px rgba(24,26,47,.06)',
        md: '0 1px 0 rgba(24,26,47,.04), 0 14px 32px rgba(24,26,47,.10)',
        btn: '0 4px 12px rgba(55,65,92,.18)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
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
