import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zh from './locales/zh'
import ru from './locales/ru'
import ja from './locales/ja'

export const i18n = createI18n({
  // Must set `false`, as Vue I18n Legacy API is for Vue 2
  legacy: false,
  locale: navigator.language.split('-')[0] || 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
    ru,
    ja
  }
})
