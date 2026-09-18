import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE, LOCALE_CODES } from '../config/locales'
import type { Locale } from '../config/locales'
import type { TranslationLayer } from './pipeline/types'
import type { LocalizedText, TranslationKey } from './source'

export type NamedValues = Record<string, string | number>

let dictionaryLoaders: Record<
  string,
  (() => Promise<TranslationLayer>) | undefined
> = {}
try {
  dictionaryLoaders = import.meta.glob<TranslationLayer>('./resolved/*.json', {
    import: 'default'
  })
} catch {
  dictionaryLoaders = {}
}

function isLocale(value: string): value is Locale {
  return (LOCALE_CODES as readonly string[]).includes(value)
}

/**
 * The locale this JavaScript is running for.
 *
 * In a browser that is the page's own `<html lang>`, which `BaseLayout` writes
 * from the same `Locale` union, so exactly one dictionary is ever fetched.
 */
function documentLocale(): Locale {
  const lang = document.documentElement.lang
  return isLocale(lang) ? lang : DEFAULT_LOCALE
}

async function loadDictionary(locale: Locale): Promise<TranslationLayer> {
  const load = dictionaryLoaders[`./resolved/${locale}.json`]
  if (load) return load()

  // No Vite, so read the file. Only reachable outside a bundler — a browser
  // always has the glob — which is why the Node import is dynamic and stays out
  // of the client graph.
  const { readFile } = await import('node:fs/promises')
  const file = new URL(`./resolved/${locale}.json`, import.meta.url)
  try {
    return JSON.parse(await readFile(file, 'utf8')) as TranslationLayer
  } catch {
    throw new Error(
      `No resolved dictionary for locale "${locale}". Run ` +
        `\`pnpm i18n:build-resolved\` — src/i18n/resolved/${locale}.json is missing.`
    )
  }
}

/**
 * Only the production browser bundle restricts itself to one locale.
 *
 * Everywhere else needs all of them in one process: `astro build` renders every
 * language server-side, and component tests mount the same component at several
 * locales in a single file. Both would break on a single dictionary, and
 * neither ships to anyone.
 *
 * `import.meta.env` is a Vite feature and is undefined without it, so this is
 * read defensively rather than directly. That assumption used to be stated the
 * other way round here — "nothing loads this module under `tsx`" — and Playwright
 * disproved it: 17 e2e specs import `t()`, and esbuild gives them no
 * `import.meta.env` at all. Undefined means "not a production browser", which is
 * the right answer everywhere it happens.
 */
const viteEnv = (import.meta as { env?: { PROD?: boolean; SSR?: boolean } }).env

const PRODUCTION_BROWSER =
  viteEnv?.PROD === true &&
  viteEnv.SSR !== true &&
  typeof document !== 'undefined'

async function loadDictionaries(): Promise<Map<Locale, TranslationLayer>> {
  const wanted = PRODUCTION_BROWSER ? [documentLocale()] : LOCALE_CODES

  const loaded = await Promise.all(
    wanted.map(
      async (locale): Promise<[Locale, TranslationLayer]> => [
        locale,
        await loadDictionary(locale)
      ]
    )
  )

  return new Map(loaded)
}

const dictionaries = await loadDictionaries()

/**
 * Any loaded dictionary, for questions that are about keys rather than text.
 *
 * It cannot be "the English one": in a browser on a Japanese page, English is
 * deliberately not loaded. Every dictionary carries the same keys in the same
 * order — `resolved.test.ts` asserts both — so any of them answers.
 */
function keySpace(): TranslationLayer {
  const first = dictionaries.values().next()
  if (first.done) throw new Error('No resolved dictionary was loaded.')
  return first.value
}

function dictionaryFor(locale: Locale): TranslationLayer {
  const dictionary = dictionaries.get(locale)
  if (!dictionary) {
    // Loud rather than silent. Falling back to the page's own locale would
    // render text the server did not, and hydration would paper over it.
    throw new Error(
      `t() asked for locale "${locale}" on a "${documentLocale()}" page. A ` +
        `component may only render its own page's locale in the browser.`
    )
  }
  return dictionary
}

const composers = new Map(
  [...dictionaries].map(([locale, dictionary]) => [
    locale,
    createI18n({
      legacy: false,
      locale,
      fallbackLocale: false,
      flatJson: true,
      messages: { [locale]: { ...dictionary } },
      missingWarn: false,
      fallbackWarn: false,
      warnHtmlMessage: false
    }).global
  ])
)

function composerFor(locale: Locale) {
  dictionaryFor(locale)
  const composer = composers.get(locale)
  if (!composer) throw new Error(`No composer for ${locale}`)
  return composer
}

export function t(
  key: TranslationKey,
  locale: Locale = DEFAULT_LOCALE,
  named: NamedValues = {}
): string {
  return composerFor(locale).t(key, named, { locale })
}

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
  return composerFor(locale).t(key, count, { locale })
}

export const translationKeys = Object.keys(keySpace()) as TranslationKey[]

export function hasKey(key: string): key is TranslationKey {
  return Object.hasOwn(keySpace(), key)
}

export type { Locale, LocalizedText, TranslationKey }
