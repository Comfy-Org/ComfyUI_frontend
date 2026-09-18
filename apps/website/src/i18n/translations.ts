import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE } from '../config/locales'
import type { Locale } from '../config/locales'
import en from '../locales/en/main.json' with { type: 'json' }
import ja from '../locales/ja/main.json' with { type: 'json' }
import zhCN from '../locales/zh-CN/main.json' with { type: 'json' }

type MessageTree = { [key: string]: string | MessageTree }

type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`
}[keyof T & string]

export type TranslationKey = LeafPaths<typeof en>

export type NamedValues = Record<string, string | number>

export type LocalizedText = { en: string; 'zh-CN': string } & Partial<
  Record<Locale, string>
>

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, 'zh-CN': zhCN, ja } satisfies Record<Locale, MessageTree>,
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false
})

export function t(
  key: TranslationKey,
  locale: Locale = DEFAULT_LOCALE,
  named: NamedValues = {}
): string {
  return i18n.global.t(key, named, { locale })
}

/**
 * Resolves a message and splits it around one named slot, so a component can
 * wrap that slot in markup while the locale decides the word order.
 */
export function tAround(
  key: TranslationKey,
  locale: Locale,
  slot: string,
  named: NamedValues = {}
): [string, string] {
  const marker = `{${slot}}`
  const [before = '', after = ''] = t(key, locale, {
    ...named,
    [slot]: marker
  }).split(marker)
  return [before, after]
}

export function tPlural(
  key: TranslationKey,
  count: number,
  locale: Locale = DEFAULT_LOCALE
): string {
  return i18n.global.t(key, count, { locale })
}

function leafPaths(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [`${prefix}${key}`]
      : leafPaths(value, `${prefix}${key}.`)
  )
}

export const translationKeys = leafPaths(en) as TranslationKey[]

const translationKeySet: ReadonlySet<string> = new Set(translationKeys)

export function hasKey(key: string): key is TranslationKey {
  return translationKeySet.has(key)
}

export type { Locale }
