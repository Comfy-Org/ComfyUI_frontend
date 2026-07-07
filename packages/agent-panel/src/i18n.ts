import { createI18n } from 'vue-i18n'

import en from './locales/en/main.json'

// Composition-API i18n. All user-facing panel strings go through this (no raw text in
// templates), so copy stays in one place and matches the Figma verbatim.
export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en }
})
