import { describe, expect, it } from 'vitest'

import { toCatalogTierKey } from './tierCatalog'

describe('toCatalogTierKey', () => {
  it.for([
    ['STANDARD', 'standard'],
    ['CREATOR', 'creator'],
    ['PRO', 'pro'],
    ['TEAM', undefined],
    ['FOUNDERS_EDITION', undefined],
    ['constructor', undefined]
  ] as const)('maps %s to %s', ([tier, expected]) => {
    expect(toCatalogTierKey(tier)).toBe(expected)
  })
})
