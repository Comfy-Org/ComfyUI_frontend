import type en from '../locales/en/main.json'
import type { Locale } from '../config/locales'
import { catalogEntries, machineLayer } from './pipeline/catalogs'
import { resolveValue } from './pipeline/resolve'

type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`
}[keyof T & string]
export type TranslationKey = LeafPaths<typeof en>
export type LocalizedText = { en: string } & Partial<Record<Locale, string>>
const entries = catalogEntries('main.json')
const entryByKey = new Map(entries.map((entry) => [entry.key, entry]))
const machine = {
  ja: machineLayer('main.json', 'ja'),
  'zh-CN': machineLayer('main.json', 'zh-CN')
}
export const sourceTranslationKeys = entries.map(
  ({ key }) => key
) as TranslationKey[]

export function localizedEntry(key: TranslationKey): LocalizedText {
  const entry = entryByKey.get(key)
  if (!entry) throw new Error(`Unknown translation key: ${key}`)
  return { en: entry.english, ...entry.approved }
}

export function resolveTranslation(key: TranslationKey, locale: Locale = 'en') {
  const entry = localizedEntry(key)
  return locale === 'en'
    ? { value: entry.en, provenance: 'english' as const }
    : resolveValue(entry.en, entry[locale], machine[locale][key])
}
