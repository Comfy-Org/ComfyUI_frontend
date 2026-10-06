import { createI18n } from 'vue-i18n'

import en from './locales/en/main.json' with { type: 'json' }

const messages = { en }

const numberFormats: Record<
  string,
  Record<string, Intl.NumberFormatOptions>
> = {
  en: {
    currency: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  }
}

const datetimeFormats: Record<
  string,
  Record<string, Intl.DateTimeFormatOptions>
> = {
  en: {
    medium: { year: 'numeric', month: 'short', day: 'numeric' }
  }
}

export function createBillingI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages,
    numberFormats,
    datetimeFormats
  })
}
