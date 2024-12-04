import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'
import ru from './locales/ru.json'
import ja from './locales/ja.json'

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

/** Convenience shorthand: i18n.global should be . */
export const { t } = i18n.global
