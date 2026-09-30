import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, LOCALE_CODES } from '../config/locales'
import type { Locale } from '../config/locales'
import en from '../locales/en/main.json' with { type: 'json' }
import ja from '../locales/ja/main.json' with { type: 'json' }
import zhCN from '../locales/zh-CN/main.json' with { type: 'json' }

type NamedValues = Record<string, string | number>

type MessageTree = { [key: string]: string | MessageTree }

type TranslatedTree<T> = {
  [K in keyof T]?: T[K] extends string ? string : TranslatedTree<T[K]>
}

export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string]

export type TranslationKey = MessageKey<typeof en>

export type LocalizedText = { en: string; 'zh-CN': string } & Partial<
  Record<Locale, string>
>

type Catalogs<T extends MessageTree> = { en: T } & Partial<
  Record<Locale, MessageTree & TranslatedTree<NoInfer<T>>>
>

interface MessageShape {
  placeholders: ReadonlySet<string>
  hasPluralForms: boolean
}

const literalPattern = /\{\s*'(?:[^'\\]|\\.)*'\s*\}/g
const placeholderPattern = /\{\s*([\w$-]+)\s*\}/g

function isMessageGroup(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function messageAtPath(tree: unknown, key: string): string | undefined {
  let value = tree
  for (const segment of key.split('.')) {
    if (!isMessageGroup(value) || !Object.hasOwn(value, segment)) return
    value = value[segment]
  }
  return typeof value === 'string' ? value : undefined
}

function leafPaths(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([segment, value]) => {
    const path = `${prefix}${segment}`
    if (segment.includes('.')) {
      throw new Error(
        `Translation key ${path} has a "." inside one segment; nest it instead`
      )
    }
    return isMessageGroup(value) ? leafPaths(value, `${path}.`) : [path]
  })
}

function pluralRule(locale: Locale) {
  const rules = new Intl.PluralRules(locale)
  return (choice: number, choicesLength: number) =>
    rules.select(choice) === 'one' ? 0 : choicesLength - 1
}

const pluralRules = Object.fromEntries(
  LOCALE_CODES.map((locale) => [locale, pluralRule(locale)])
)

/**
 * Builds `t`, `tAround` and `tPlural` over one set of catalogs. Features whose
 * copy should ship only with their own pages keep a catalog of their own
 * (`src/locales/<locale>/<feature>.json`) and call this with it.
 */
export function createTranslator<T extends MessageTree>(catalogs: Catalogs<T>) {
  type Key = MessageKey<T>

  const i18n = createI18n({
    legacy: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    messages: catalogs,
    messageResolver: (tree, key) => messageAtPath(tree, key) ?? null,
    pluralRules,
    missingWarn: false,
    fallbackWarn: false,
    warnHtmlMessage: false
  })
  const keys = leafPaths(catalogs.en) as Key[]
  const keySet: ReadonlySet<string> = new Set(keys)
  for (const locale of LOCALE_CODES) {
    if (locale === DEFAULT_LOCALE) continue
    const orphans = leafPaths(catalogs[locale] ?? {}).filter(
      (key) => !keySet.has(key)
    )
    if (orphans.length > 0) {
      throw new Error(
        `Translations in ${locale} have no English message: ${orphans.join(', ')}`
      )
    }
  }
  const shapes = new Map<string, MessageShape>()

  function hasKey(key: string): key is Key {
    return keySet.has(key)
  }

  function shapeOf(key: Key, locale: Locale): MessageShape {
    const cacheKey = `${locale}:${key}`
    const cached = shapes.get(cacheKey)
    if (cached) return cached

    const message =
      messageAtPath(catalogs[locale], key) ?? messageAtPath(catalogs.en, key)
    if (message === undefined) throw new Error(`Unknown translation key ${key}`)
    const source = message.replace(literalPattern, '')
    if (source.includes('@')) {
      throw new Error(
        `Translation ${key} in ${locale} has an unescaped "@": write {'@'} for a literal at sign`
      )
    }
    const placeholders = new Set<string>()
    for (const [text, name] of source.matchAll(placeholderPattern)) {
      if (/^-?\d+$/.test(name)) {
        throw new Error(
          `Translation ${key} in ${locale} uses the list placeholder ${text}; name it instead`
        )
      }
      placeholders.add(name)
    }
    const shape = { placeholders, hasPluralForms: source.includes('|') }
    shapes.set(cacheKey, shape)
    return shape
  }

  function requireValues(
    key: Key,
    locale: Locale,
    placeholders: ReadonlySet<string>,
    named: NamedValues
  ) {
    const missing = [...placeholders].filter(
      (name) => !Object.hasOwn(named, name)
    )
    if (missing.length > 0) {
      throw new Error(
        `Translation ${key} in ${locale} needs values for ${missing.map((name) => `{${name}}`).join(', ')}`
      )
    }
  }

  function render(key: Key, locale: Locale, translate: () => string): string {
    try {
      return translate()
    } catch (error) {
      throw new Error(
        `Translation ${key} in ${locale} is not valid message syntax (vue-i18n: ${error instanceof Error ? error.message : String(error)})`,
        { cause: error }
      )
    }
  }

  function t(
    key: Key,
    locale: Locale = DEFAULT_LOCALE,
    named: NamedValues = {}
  ): string {
    const { placeholders, hasPluralForms } = shapeOf(key, locale)
    if (hasPluralForms) {
      throw new Error(
        `Translation ${key} in ${locale} has an unescaped "|": write {'|'} for a literal pipe, or read plural forms with tPlural`
      )
    }
    requireValues(key, locale, placeholders, named)
    return render(key, locale, () => i18n.global.t(key, named, { locale }))
  }

  /**
   * Resolves a message and splits it around one named slot, so a component can
   * wrap that slot in markup while the locale decides the word order.
   */
  function tAround(
    key: Key,
    locale: Locale,
    slot: string,
    named: NamedValues = {}
  ): [string, string] {
    const marker = `{${slot}}`
    const slotSentinel = `\u0000${slot}\u0000`
    const message = t(key, locale, {
      ...named,
      [slot]: slotSentinel
    })
    const slotIndex = message.indexOf(slotSentinel)
    if (slotIndex === -1) {
      throw new Error(
        `Translation ${key} in ${locale} is missing slot ${marker}`
      )
    }
    if (message.indexOf(slotSentinel, slotIndex + slotSentinel.length) !== -1) {
      throw new Error(`Translation ${key} in ${locale} repeats slot ${marker}`)
    }
    return [
      message.slice(0, slotIndex),
      message.slice(slotIndex + slotSentinel.length)
    ]
  }

  function tPlural(
    key: Key,
    count: number,
    locale: Locale = DEFAULT_LOCALE,
    named: NamedValues = {}
  ): string {
    const values = { ...named, count }
    requireValues(key, locale, shapeOf(key, locale).placeholders, values)
    return render(key, locale, () =>
      i18n.global.t(key, values, { locale, plural: count })
    )
  }

  return { t, tAround, tPlural, hasKey, keys }
}

const site = createTranslator({ en, 'zh-CN': zhCN, ja })

export const { t, tAround, tPlural, hasKey } = site

export const translationKeys = site.keys

export type { Locale }
