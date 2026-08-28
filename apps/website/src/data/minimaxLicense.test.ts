import { describe, expect, it } from 'vitest'

import { minimaxLicenseComparison } from './minimaxLicense'

const LOCALES = ['en', 'zh-CN'] as const

// zh-CN spells currency as 美元 rather than a symbol, so a symbol-only check
// would pass on a leak in that locale.
const CURRENCY = /[$¥€]|美元/

function cellsFor(columnId: 'professional' | 'enterprise') {
  return minimaxLicenseComparison.rows.map((row) => ({
    id: row.id,
    value: row.values[columnId]
  }))
}

describe('minimaxLicenseComparison', () => {
  it('quotes no Enterprise price in either locale', () => {
    const offenders = cellsFor('enterprise').flatMap(({ id, value }) =>
      LOCALES.filter((locale) => CURRENCY.test(value[locale])).map(
        (locale) => `${id} (${locale}): ${value[locale]}`
      )
    )

    expect(offenders).toEqual([])
  })

  it('still publishes every Professional rate', () => {
    const priced = cellsFor('professional')
      .filter(({ value }) =>
        LOCALES.every((locale) => CURRENCY.test(value[locale]))
      )
      .map(({ id }) => id)

    expect(priced).toEqual(['price', 'bundle-rate', 'overage-rate'])
  })
})
