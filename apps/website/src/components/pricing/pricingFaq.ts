import type { Locale } from '@/config/locales'

interface FaqEntry {
  id: string
  data: { order: number }
}

export function selectFaqEntries<T extends FaqEntry>(
  entries: readonly T[],
  category: 'pricing' | 'enterprise',
  locale: Locale
): T[] {
  const englishPrefix = `${category}/en/`
  const localePrefix = `${category}/${locale}/`
  const localized = new Map(
    entries
      .filter(({ id }) => id.startsWith(localePrefix))
      .map((entry) => [entry.id.slice(localePrefix.length), entry])
  )

  return entries
    .filter(({ id }) => id.startsWith(englishPrefix))
    .toSorted((a, b) => a.data.order - b.data.order)
    .map(
      (entry) => localized.get(entry.id.slice(englishPrefix.length)) ?? entry
    )
}
