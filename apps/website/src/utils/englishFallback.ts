import { DEFAULT_LOCALE } from '../config/locales'

/**
 * A collection's entries for a locale, falling back to English when it has none.
 *
 * Astro's i18n fallback covers pages. Content read at render time sits outside
 * it and has to say so itself: the FAQ and customer-story collections both hold
 * `en` and `zh-CN` only, so once one page file served every language `/ja/pricing`
 * rendered its FAQ heading above nothing and `/ja/customers` built a listing
 * page with no listings. Missing content is worse than English content, because
 * the reader cannot tell it was ever there.
 *
 * `load` is injected rather than importing `getCollection`, so the decision can
 * be tested without an Astro content collection.
 */
export async function withEnglishFallback<T>(
  locale: string,
  load: (code: string) => Promise<T[]>
): Promise<T[]> {
  const localized = await load(locale)
  // An empty ENGLISH collection is a real answer, not a reason to load again.
  if (localized.length > 0 || locale === DEFAULT_LOCALE) return localized
  return load(DEFAULT_LOCALE)
}

/**
 * A collection's entries for a locale, with English filling any individual gap.
 *
 * `withEnglishFallback` is all-or-nothing: it falls back only when the locale
 * has nothing at all. That was enough while a locale either had every answer or
 * none, and it stopped being enough when the writer learned to withdraw a
 * rejected translation — a locale holding 20 of 21 answers returned 20, and the
 * twenty-first disappeared from the page instead of appearing in English. A
 * reader cannot tell a missing answer was ever there.
 *
 * `identify` maps an entry to the id shared across locales, since the entry ids
 * themselves carry the locale (`pricing/ja/credits` against `pricing/en/credits`).
 */
export async function mergedWithEnglish<T>(
  locale: string,
  load: (code: string) => Promise<T[]>,
  identify: (entry: T) => string
): Promise<T[]> {
  const english = await load(DEFAULT_LOCALE)
  if (locale === DEFAULT_LOCALE) return english

  const localized = new Map(
    (await load(locale)).map((entry) => [identify(entry), entry])
  )
  // Walked in English order, so a withdrawn answer keeps its place rather than
  // moving to the end of the page.
  return english.map((entry) => localized.get(identify(entry)) ?? entry)
}
