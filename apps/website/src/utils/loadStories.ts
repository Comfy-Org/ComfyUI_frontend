import { getCollection } from 'astro:content'

import type { Locale } from '../i18n/translations'
import type { CustomerStoryEntry } from './customers'
import { sortStories } from './customers'

// Loads a locale's customer stories from the content collection, sorted by the
// frontmatter `order`. Centralises the `<locale>/` id-prefix convention so the
// listing and detail pages do not each hardcode it.
export async function loadStories(
  locale: Locale
): Promise<CustomerStoryEntry[]> {
  const stories = await getCollection('customers', ({ id }) =>
    id.startsWith(`${locale}/`)
  )
  return sortStories(stories)
}
