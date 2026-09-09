import { getCollection } from 'astro:content'

import type { Locale } from '../i18n/translations'
import type { CustomerStoryEntry } from './customers'
import { sortStories } from './customers'
import { withEnglishFallback } from './englishFallback'

// Loads a locale's customer stories from the content collection, sorted by the
// frontmatter `order`. Centralises the `<locale>/` id-prefix convention so the
// listing and detail pages do not each hardcode it. The English fallback, and
// why it is needed, live in `englishFallback.ts` where they are covered.
export async function loadStories(
  locale: Locale
): Promise<CustomerStoryEntry[]> {
  return sortStories(
    await withEnglishFallback(locale, (code) =>
      getCollection('customers', ({ id }) => id.startsWith(`${code}/`))
    )
  )
}
