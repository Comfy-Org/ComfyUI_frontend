import { getCollection } from 'astro:content'

import { DEFAULT_LOCALE } from '../config/locales'
import type { Locale } from '../i18n/translations'
import type { CustomerStoryEntry } from './customers'
import { sortStories } from './customers'

// Loads a locale's customer stories from the content collection, sorted by the
// frontmatter `order`. Centralises the `<locale>/` id-prefix convention so the
// listing and detail pages do not each hardcode it.
//
// A locale with no stories falls back to English rather than to nothing. The
// collection has `en` and `zh-CN` only, so once one page file served every
// language `/ja/customers` built a listing page with no listings on it. Astro's
// i18n fallback does exactly this for pages; content read at render time is
// outside it and has to say so itself.
export async function loadStories(
  locale: Locale
): Promise<CustomerStoryEntry[]> {
  const stories = await getCollection('customers', ({ id }) =>
    id.startsWith(`${locale}/`)
  )
  if (stories.length > 0 || locale === DEFAULT_LOCALE) {
    return sortStories(stories)
  }
  return sortStories(
    await getCollection('customers', ({ id }) =>
      id.startsWith(`${DEFAULT_LOCALE}/`)
    )
  )
}
