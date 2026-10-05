import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE } from '@/config/locales'
import type { Locale } from '@/config/locales'
import en from '@/locales/en/main.json' with { type: 'json' }
import ja from '@/locales/ja/main.json' with { type: 'json' }
import zhCN from '@/locales/zh-CN/main.json' with { type: 'json' }

type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string]

export type TranslationKey = MessageKey<typeof en>

export type LocalizedText = { en: string; 'zh-CN': string } & Partial<
  Record<Locale, string>
>

function createSiteI18n(locale: Locale) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: DEFAULT_LOCALE,
    messages: { en, 'zh-CN': zhCN, ja },
    missingWarn: false,
    fallbackWarn: false,
    warnHtmlMessage: false
  })
}

const siteI18nByLocale = {
  en: createSiteI18n('en'),
  'zh-CN': createSiteI18n('zh-CN'),
  ja: createSiteI18n('ja')
} satisfies Record<Locale, ReturnType<typeof createSiteI18n>>

export function translationsFor(locale: Locale) {
  return siteI18nByLocale[locale].global
}

export const { t, te } = translationsFor(DEFAULT_LOCALE)

export type { Locale }
