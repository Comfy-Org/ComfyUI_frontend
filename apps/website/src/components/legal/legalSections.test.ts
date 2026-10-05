import { describe, expect, it } from 'vitest'

import { getRoutes } from '@/config/routes'
import { t, te } from '@/i18n/translations'
import en from '@/locales/en/main.json' with { type: 'json' }

const PREFIX = 'affiliate-terms'
const EXPECTED_SECTION_IDS = [
  '1-program-overview',
  '2-eligible-products',
  '3-commission-structure',
  '4-attribution-rules',
  '5-prohibited-activities',
  '6-content-guidelines',
  '7-termination',
  '8-program-modifications',
  '9-indemnification',
  '10-governing-law',
  '11-miscellaneous'
] as const

function deriveAffiliateSectionIds(): string[] {
  return Object.keys(en[PREFIX]).filter((key) => /^[0-9]+-[a-z-]+$/.test(key))
}

describe('affiliate terms i18n', () => {
  it('exposes the eleven canonical sections in numeric order', () => {
    const ids = deriveAffiliateSectionIds()
    expect(ids).toEqual([...EXPECTED_SECTION_IDS])
  })

  it('every section has a label, title, and at least one block', () => {
    for (const id of EXPECTED_SECTION_IDS) {
      expect(te(`${PREFIX}.${id}.label`, 'en')).toBe(true)
      expect(te(`${PREFIX}.${id}.title`, 'en')).toBe(true)
      expect(te(`${PREFIX}.${id}.block.0`, 'en')).toBe(true)
    }
  })

  it('section titles follow the "N. Section Name" pattern', () => {
    for (const id of EXPECTED_SECTION_IDS) {
      const title = t(`${PREFIX}.${id}.title` as never)
      const numberPrefix = id.split('-')[0]
      expect(title).toMatch(new RegExp(`^${numberPrefix}\\. `))
    }
  })

  it('exposes the effective date and page-chrome keys editors will need', () => {
    expect(te('affiliate-terms.effective-date', 'en')).toBe(true)
    expect(te('affiliate-terms.page.title', 'en')).toBe(true)
    expect(te('affiliate-terms.page.heading', 'en')).toBe(true)
    expect(te('affiliate-terms.page.tocLabel', 'en')).toBe(true)
    expect(te('affiliate-terms.page.effectiveDateLabel', 'en')).toBe(true)
  })

  it('does not include any internal-only "Competitive analysis" or "Open questions" keys', () => {
    const internalRegex = /(competitive-analysis|open-questions|legal-review)/
    const leaks = Object.keys(en[PREFIX]).filter((key) =>
      internalRegex.test(key)
    )
    expect(leaks).toEqual([])
  })

  it('exposes affiliate terms at the canonical /affiliates/terms path regardless of locale', () => {
    // Guards against re-introducing /zh-CN/affiliates/terms, which would
    // serve an unreviewed translation of legal-reviewed copy. See the
    // comment on LOCALE_INVARIANT_ROUTE_KEYS in src/config/routes.ts.
    expect(getRoutes('en').affiliateTerms).toBe('/affiliates/terms/')
    expect(getRoutes('zh-CN').affiliateTerms).toBe('/affiliates/terms/')
  })
})
