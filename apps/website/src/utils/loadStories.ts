import { getCollection } from 'astro:content'

import type { Locale } from '../i18n/translations'
import type { CustomerStoryEntry } from './customers'
import { sortStories } from './customers'
import { mergedWithEnglish } from './englishFallback'

// Loads a locale's customer stories from the content collection, sorted by the
// frontmatter `order`. Centralises the `<locale>/` id-prefix convention so the
// listing and detail pages do not each hardcode it. The English fallback, and
// why it is needed, live in `englishFallback.ts` where they are covered.
export async function loadStories(
  locale: Locale
): Promise<CustomerStoryEntry[]> {
  // Merged per story, not per collection. All-or-nothing meant a locale missing
  // one story lost it from the page entirely rather than showing it in English,
  // and a story can now go missing on its own: `enforce` withdraws a rejected
  // translation, and English copy changing drops its translation as stale.
  return sortStories(
    await mergedWithEnglish(
      locale,
      (code) =>
        getCollection('customers', ({ id }) => id.startsWith(`${code}/`)),
      (entry) => entry.id.split('/').pop() ?? entry.id
    )
  )
}
