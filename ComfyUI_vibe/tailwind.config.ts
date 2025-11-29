import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic colors matching ComfyUI_frontend design system
        surface: {
          DEFAULT: 'var(--p-surface-0)',
          ground: 'var(--p-surface-ground)',
          section: 'var(--p-surface-section)',
          card: 'var(--p-surface-card)',
          overlay: 'var(--p-surface-overlay)',
          border: 'var(--p-surface-border)',
          hover: 'var(--p-surface-hover)'
        },
        primary: {
          DEFAULT: 'var(--p-primary-color)',
          contrast: 'var(--p-primary-contrast-color)',
          hover: 'var(--p-primary-hover-color)',
          active: 'var(--p-primary-active-color)'
        },
        highlight: {
          DEFAULT: 'var(--p-highlight-background)',
          focus: 'var(--p-highlight-focus-background)',
          text: 'var(--p-highlight-color)',
          'focus-text': 'var(--p-highlight-focus-color)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
