import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE } from '../config/locales'
import type { Locale } from '../config/locales'
import en from '../locales/en/main.json' with { type: 'json' }
import ja from '../locales/ja/main.json' with { type: 'json' }
import zhCN from '../locales/zh-CN/main.json' with { type: 'json' }

export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string]

export type TranslationKey = MessageKey<typeof en>

export type LocalizedText = { en: string; 'zh-CN': string } & Partial<
  Record<Locale, string>
>

const siteI18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, 'zh-CN': zhCN, ja },
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false
})

export const { t, te } = siteI18n.global

export type { Locale }
