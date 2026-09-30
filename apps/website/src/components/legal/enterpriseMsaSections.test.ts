import { describe, expect, it } from 'vitest'

import { getRoutes } from '../../config/routes'
import { te } from '../../i18n/site'
import en from '../../locales/en/main.json' with { type: 'json' }

const PREFIX = 'enterprise-msa'

function deriveMsaSectionIds(): string[] {
  return Object.keys(en[PREFIX]).filter((key) => /^[0-9]+-[a-z-]+$/.test(key))
}

describe('enterprise MSA i18n', () => {
  it('exposes the sections in numeric order', () => {
    expect(deriveMsaSectionIds().map((id) => parseInt(id))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
    ])
  })

  it('every derived section has a title and at least one block', () => {
    const sectionIds = deriveMsaSectionIds()
    expect(sectionIds.length).toBeGreaterThan(0)
    for (const id of sectionIds) {
      expect(te(`${PREFIX}.${id}.title`, 'en')).toBe(true)
      expect(te(`${PREFIX}.${id}.block.0`, 'en')).toBe(true)
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
      expect(te(`${PREFIX}.${suffix}`, 'en')).toBe(true)
    }
  })

  it('serves the enterprise MSA at the canonical /enterprise-msa path regardless of locale', () => {
    expect(getRoutes('en').enterpriseMsa).toBe('/enterprise-msa/')
    expect(getRoutes('zh-CN').enterpriseMsa).toBe('/enterprise-msa/')
  })
})
