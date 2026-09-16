import { createI18n } from 'vue-i18n'

import en from './locales/en/main.json' with { type: 'json' }

const messages = { en }

export function createBillingI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages
  })
}
