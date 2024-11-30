import { createI18n } from 'vue-i18n'
import en from './locales/en_US.json'
import zh from './locales/zh_CN.json'
import ru from './locales/ru_RU.json'
import ja from './locales/ja_JP.json'

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
