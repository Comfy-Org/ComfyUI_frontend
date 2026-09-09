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
