import type { Locale, LocalizedText } from '@/i18n/translations'

export type CopyValues = Record<string, string | number>

/**
 * An app's copy entry in `locale` (English when it has none), with each
 * `{name}` filled from `named`. A `one | many` entry picks by `named.n`.
 */
export function appCopy(
  entry: LocalizedText,
  locale: Locale,
  named: CopyValues = {}
): string {
  const [one, many = one] = (entry[locale] ?? entry.en).split(' | ')
  return (named.n === 1 ? one : many).replace(
    /\{(\w+)\}/g,
    (placeholder, name: string) =>
      Object.hasOwn(named, name) ? String(named[name]) : placeholder
  )
}
