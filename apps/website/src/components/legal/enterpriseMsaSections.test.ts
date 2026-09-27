import { describe, expect, it } from 'vitest'

import { getRoutes } from '../../config/routes'
import { hasKey, translationKeys } from '../../i18n/translations'

const PREFIX = 'enterprise-msa'

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
  it('every derived section has a title and at least one block', () => {
    const sectionIds = deriveMsaSectionIds()
    expect(sectionIds.length).toBeGreaterThan(0)
    for (const id of sectionIds) {
      expect(hasKey(`${PREFIX}.${id}.title`)).toBe(true)
      expect(hasKey(`${PREFIX}.${id}.block.0`)).toBe(true)
    }
  })

  it('exposes the page-chrome keys the .astro file references', () => {
    for (const suffix of [
      'effective-date',
      'page.title',
      'page.description',
      'page.heading',
      'page.tocLabel',
      'page.effectiveDateLabel',
      'page.parties'
    ]) {
      expect(hasKey(`${PREFIX}.${suffix}`)).toBe(true)
    }
  })

  it('serves the enterprise MSA at the canonical /enterprise-msa path regardless of locale', () => {
    expect(getRoutes('en').enterpriseMsa).toBe('/enterprise-msa')
    expect(getRoutes('zh-CN').enterpriseMsa).toBe('/enterprise-msa')
  })
})
