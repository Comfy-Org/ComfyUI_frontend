import { describe, expect, it } from 'vitest'

import { selectFaqEntries } from './pricingFaq'

describe('selectFaqEntries', () => {
  it.for([
    { locale: 'en', expected: ['pricing/en/plans', 'pricing/en/credits'] },
    { locale: 'ja', expected: ['pricing/ja/plans', 'pricing/en/credits'] },
    { locale: 'zh-CN', expected: ['pricing/en/plans', 'pricing/en/credits'] }
  ] as const)(
    'keeps every current FAQ in English order for $locale',
    ({ locale, expected }) => {
      const entries = [
        { id: 'pricing/en/credits', data: { order: 2 } },
        { id: 'pricing/en/plans', data: { order: 1 } },
        { id: 'pricing/ja/plans', data: { order: 3 } },
        { id: 'pricing/ja/retired', data: { order: 0 } },
        { id: 'enterprise/en/plans', data: { order: 0 } }
      ]

      expect(
        selectFaqEntries(entries, 'pricing', locale).map(({ id }) => id)
      ).toEqual(expected)
    }
  )
})
