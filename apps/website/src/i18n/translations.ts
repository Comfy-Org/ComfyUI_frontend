import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, LOCALE_CODES } from '../config/locales'
import type { Locale } from '../config/locales'
import en from '../locales/en/main.json' with { type: 'json' }
import ja from '../locales/ja/main.json' with { type: 'json' }
import zhCN from '../locales/zh-CN/main.json' with { type: 'json' }

type NamedValues = Record<string, string | number>

type MessageTree = { [key: string]: string | MessageTree }

export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`
}[keyof T & string]

export type TranslationKey = MessageKey<typeof en>

export type LocalizedText = { en: string; 'zh-CN': string } & Partial<
  Record<Locale, string>
>

type Catalogs<T extends MessageTree> = { en: T } & Partial<
  Record<Locale, MessageTree>
>

interface MessageShape {
  placeholderDefaults: NamedValues
  hasPluralForms: boolean
}

const literalPattern = /\{'(?:[^'\\]|\\.)*'\}/g
const placeholderPattern = /\{\s*(\w+)\s*\}/g

function messageAtPath(
  tree: MessageTree | undefined,
  key: string
): string | undefined {
  let value: string | MessageTree | undefined = tree
  for (const segment of key.split('.')) {
    if (value === undefined || typeof value === 'string') return
    if (!Object.hasOwn(value, segment)) return
    value = value[segment]
  }
  return typeof value === 'string' ? value : undefined
}

function leafPaths(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [`${prefix}${key}`]
      : leafPaths(value, `${prefix}${key}.`)
  )
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
    pluralRules,
    missingWarn: false,
    fallbackWarn: false,
    warnHtmlMessage: false
  })
  const keys = leafPaths(catalogs.en) as Key[]
  const keySet: ReadonlySet<string> = new Set(keys)
  const shapes = new Map<string, MessageShape>()

  function hasKey(key: string): key is Key {
    return keySet.has(key)
  }

  function shapeOf(key: Key, locale: Locale): MessageShape {
    const cacheKey = `${locale}:${key}`
    const cached = shapes.get(cacheKey)
    if (cached) return cached

    if (!hasKey(key)) throw new Error(`Unknown translation key ${key}`)
    const source = (
      messageAtPath(catalogs[locale], key) ??
      messageAtPath(catalogs.en, key) ??
      ''
    ).replace(literalPattern, '')
    const placeholderDefaults: NamedValues = {}
    for (const [text, name] of source.matchAll(placeholderPattern)) {
      if (/^\d+$/.test(name)) {
        throw new Error(
          `Translation ${key} in ${locale} uses the list placeholder ${text}; name it instead`
        )
      }
      placeholderDefaults[name] = text
    }
    const shape = { placeholderDefaults, hasPluralForms: source.includes('|') }
    shapes.set(cacheKey, shape)
    return shape
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
    const { placeholderDefaults, hasPluralForms } = shapeOf(key, locale)
    if (hasPluralForms) {
      throw new Error(
        `Translation ${key} in ${locale} has an unescaped "|": write {'|'} for a literal pipe, or read plural forms with tPlural`
      )
    }
    return render(key, locale, () =>
      i18n.global.t(key, { ...placeholderDefaults, ...named }, { locale })
    )
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
      throw new Error(`Translation ${key} is missing slot ${marker}`)
    }
    if (message.indexOf(slotSentinel, slotIndex + slotSentinel.length) !== -1) {
      throw new Error(`Translation ${key} repeats slot ${marker}`)
    }
    return [
      message.slice(0, slotIndex),
      message.slice(slotIndex + slotSentinel.length)
    ]
  }

  function tPlural(
    key: Key,
    count: number,
    locale: Locale = DEFAULT_LOCALE
  ): string {
    shapeOf(key, locale)
    return render(key, locale, () => i18n.global.t(key, count, { locale }))
  }

  return { t, tAround, tPlural, hasKey, keys }
}

const site = createTranslator({ en, 'zh-CN': zhCN, ja })

export const { t, tAround, tPlural, hasKey } = site

export const translationKeys = site.keys

export type { Locale }
