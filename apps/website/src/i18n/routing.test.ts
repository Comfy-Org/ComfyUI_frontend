import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALES } from './locales'
import { localePaths } from './routing'

describe('localePaths', () => {
  it('returns exactly one entry per locale', () => {
    expect(localePaths()).toHaveLength(LOCALES.length)
  })

  it('maps the default locale to an undefined param so the root route is emitted', () => {
    const undefinedEntries = localePaths().filter(
      (entry) => entry.params.locale === undefined
    )

    expect(undefinedEntries).toHaveLength(1)
  })

  it('maps each non-default locale to its own prefix param', () => {
    const paths = localePaths()

    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue
      expect(paths).toContainEqual({ params: { locale } })
    }
  })
})
