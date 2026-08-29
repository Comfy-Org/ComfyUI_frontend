import { describe, expect, it } from 'vitest'

import type { TranslationKey } from '../i18n/translations'
import { t } from '../i18n/translations'
import { minimaxLicenseComparison } from './minimaxLicense'

const LOCALES = ['en', 'zh-CN'] as const

// zh-CN spells currency as 美元 rather than a symbol, so a symbol-only check
// would pass on a leak in that locale.
const CURRENCY = /[$¥€]|美元/

// Enterprise is quote-only, so the surrounding copy may not state a rate or the
// basis one is charged on, even without naming a figure.
const BANNED_IN_COPY = [
  /\$\d/,
  /\d\s*美元/,
  /volume pricing/i,
  /committed volume/i,
  /video-second/i,
  /批量定价/,
  /承诺用量/,
  /视频秒/
]

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

  it('states no Enterprise rate or pricing basis in the section copy', () => {
    const keys = [
      minimaxLicenseComparison.headingKey,
      minimaxLicenseComparison.subtitleKey,
      minimaxLicenseComparison.footnoteKey,
      minimaxLicenseComparison.primaryCta?.labelKey
    ].filter((key): key is TranslationKey => key !== undefined)

    const offenders = keys.flatMap((key) =>
      LOCALES.flatMap((locale) =>
        BANNED_IN_COPY.filter((pattern) => pattern.test(t(key, locale))).map(
          (pattern) => `${key} (${locale}) matches ${String(pattern)}`
        )
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
