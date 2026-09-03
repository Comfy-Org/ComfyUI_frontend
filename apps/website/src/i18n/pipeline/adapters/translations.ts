/**
 * The `translations.ts` source adapter.
 *
 * The largest of the three marketing copy sources: 1,766 keys, about 80% of the
 * translatable surface. `src/data/*.ts` and the MDX collections get their own
 * adapters later and plug in through the same interface.
 */
import { DEFAULT_LOCALE, LOCALE_CODES } from '../../../config/locales'
import type { Locale } from '../../../config/locales'
import { localizedEntry, translationKeys } from '../../translations'
import type { SourceAdapter, SourceEntry } from '../types'

export const translationsAdapter: SourceAdapter = {
  name: 'translations',

  read(): SourceEntry[] {
    return translationKeys.map((key) => {
      const entry = localizedEntry(key)
      const approved: Partial<Record<Locale, string>> = {}
      for (const locale of LOCALE_CODES) {
        // English is the source, not a translation. Recording it as approved
        // would make it a layer competing with itself.
        if (locale === DEFAULT_LOCALE) continue
        const value = entry[locale]
        if (typeof value === 'string') approved[locale] = value
      }
      return { key, english: entry.en, approved }
    })
  }
}
