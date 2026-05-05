import { describe, expect, it } from 'vitest'

import { hasKey, t, translationKeys } from '../../i18n/translations'

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
  const labelRegex = new RegExp(`^${PREFIX}\\.([0-9]+-[a-z-]+)\\.label$`)
  const ids: string[] = []
  for (const key of translationKeys) {
    const match = key.match(labelRegex)
    if (match && !ids.includes(match[1])) ids.push(match[1])
  }
  return ids
}

describe('affiliate terms i18n', () => {
  it('exposes the eleven canonical sections in numeric order', () => {
    const ids = deriveAffiliateSectionIds()
    expect(ids).toEqual([...EXPECTED_SECTION_IDS])
  })

  it('every section has a label, title, and at least one block', () => {
    for (const id of EXPECTED_SECTION_IDS) {
      expect(hasKey(`${PREFIX}.${id}.label`)).toBe(true)
      expect(hasKey(`${PREFIX}.${id}.title`)).toBe(true)
      expect(hasKey(`${PREFIX}.${id}.block.0`)).toBe(true)
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
    expect(hasKey('affiliate-terms.effective-date')).toBe(true)
    expect(hasKey('affiliate-terms.page.title')).toBe(true)
    expect(hasKey('affiliate-terms.page.heading')).toBe(true)
    expect(hasKey('affiliate-terms.page.tocLabel')).toBe(true)
    expect(hasKey('affiliate-terms.page.effectiveDateLabel')).toBe(true)
    expect(hasKey('affiliate-terms.page.lastUpdatedLabel')).toBe(true)
  })

  it('does not include any internal-only "Competitive analysis" or "Open questions" keys', () => {
    const internalRegex = /(competitive-analysis|open-questions|legal-review)/
    const leaks = translationKeys.filter(
      (key) => key.startsWith(PREFIX) && internalRegex.test(key)
    )
    expect(leaks).toEqual([])
  })
})
