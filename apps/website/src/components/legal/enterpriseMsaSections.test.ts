import { describe, expect, it } from 'vitest'

import { getRoutes } from '../../config/routes'
import { hasKey, t, translationKeys } from '../../i18n/translations'

const PREFIX = 'enterprise-msa'
const EXPECTED_SECTION_IDS = [
  '1-definitions',
  '2-comfy-products',
  '3-customer-responsibilities',
  '4-payment',
  '5-term-termination',
  '6-confidentiality',
  '7-proprietary-rights',
  '8-warranties-disclaimer',
  '9-limitation-of-liability',
  '10-indemnification',
  '11-miscellaneous',
  '12-exhibit-a'
] as const

function deriveMsaSectionIds(): string[] {
  const labelRegex = new RegExp(`^${PREFIX}\\.([0-9]+-[a-z-]+)\\.label$`)
  const ids: string[] = []
  for (const key of translationKeys) {
    const match = key.match(labelRegex)
    if (match && !ids.includes(match[1])) ids.push(match[1])
  }
  return ids
}

describe('enterprise MSA i18n', () => {
  it('exposes the twelve canonical sections in numeric order', () => {
    const ids = deriveMsaSectionIds()
    expect(ids).toEqual([...EXPECTED_SECTION_IDS])
  })

  it('every section has a label, title, and at least one block', () => {
    for (const id of EXPECTED_SECTION_IDS) {
      expect(hasKey(`${PREFIX}.${id}.label`)).toBe(true)
      expect(hasKey(`${PREFIX}.${id}.title`)).toBe(true)
      expect(hasKey(`${PREFIX}.${id}.block.0`)).toBe(true)
    }
  })

  it('numbered section titles follow the "N. Section Name" pattern', () => {
    for (const id of EXPECTED_SECTION_IDS) {
      const title = t(`${PREFIX}.${id}.title` as never)
      const numberPrefix = id.split('-')[0]
      const isExhibit = id === '12-exhibit-a'
      const expectedRegex = isExhibit
        ? /^Exhibit A\. /
        : new RegExp(`^${numberPrefix}\\. `)
      expect(title).toMatch(expectedRegex)
    }
  })

  it('exposes the effective date and page-chrome keys editors will need', () => {
    expect(hasKey('enterprise-msa.effective-date')).toBe(true)
    expect(hasKey('enterprise-msa.page.title')).toBe(true)
    expect(hasKey('enterprise-msa.page.description')).toBe(true)
    expect(hasKey('enterprise-msa.page.heading')).toBe(true)
    expect(hasKey('enterprise-msa.page.tocLabel')).toBe(true)
    expect(hasKey('enterprise-msa.page.effectiveDateLabel')).toBe(true)
    expect(hasKey('enterprise-msa.page.parties')).toBe(true)
  })

  it('exposes the enterprise MSA at the canonical /enterprise-msa path regardless of locale', () => {
    // Legal-reviewed English-only document; localized routes would serve an
    // unreviewed translation. See LOCALE_INVARIANT_ROUTE_KEYS in
    // src/config/routes.ts.
    expect(getRoutes('en').enterpriseMsa).toBe('/enterprise-msa')
    expect(getRoutes('zh-CN').enterpriseMsa).toBe('/enterprise-msa')
  })

  it('exposes the footer link so the MSA is discoverable site-wide', () => {
    expect(hasKey('footer.enterpriseMsa')).toBe(true)
  })
})
