import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

export const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  escapeParameter: true,
  messages: { en: enMessages }
})
