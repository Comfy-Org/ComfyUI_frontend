import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE } from '../locales/localeConfig'
import type { Locale } from '../locales/localeConfig'
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

const messages = { en, 'zh-CN': zhCN, ja } satisfies Record<Locale, MessageTree>

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  missingWarn: false,
  fallbackWarn: false,
  warnHtmlMessage: false
})

function messageAtPath(tree: MessageTree, key: string): string | undefined {
  let value: string | MessageTree = tree
  for (const segment of key.split('.')) {
    if (typeof value === 'string') return
    if (!Object.hasOwn(value, segment)) return
    value = value[segment]
  }
  return typeof value === 'string' ? value : undefined
}

function preserveMissingNamedValues(
  key: TranslationKey,
  locale: Locale,
  named: NamedValues
): NamedValues {
  const message =
    messageAtPath(messages[locale], key) ??
    messageAtPath(messages[DEFAULT_LOCALE], key)
  if (!message) return named

  return Array.from(message.matchAll(/\{(\w+)\}/g)).reduce<NamedValues>(
    (values, [placeholder, name]) =>
      name && !Object.hasOwn(values, name)
        ? { ...values, [name]: placeholder }
        : values,
    named
  )
}

export function t(
  key: TranslationKey,
  locale: Locale = DEFAULT_LOCALE,
  named: NamedValues = {}
): string {
  return i18n.global.t(key, preserveMissingNamedValues(key, locale, named), {
    locale
  })
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
  const message = t(key, locale, {
    ...named,
    [slot]: marker
  })
  const markerIndex = message.indexOf(marker)
  if (message.indexOf(marker, markerIndex + marker.length) !== -1) {
    throw new Error(`Translation ${key} repeats slot ${marker}`)
  }
  return markerIndex === -1
    ? [message, '']
    : [
        message.slice(0, markerIndex),
        message.slice(markerIndex + marker.length)
      ]
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
