import { describe, expect, it } from 'vitest'

import { getRoutes } from '@/config/routes'

import { drops, isRecentLaunch } from './drops'

const NOW = new Date('2026-10-01T12:00:00Z')

describe('isRecentLaunch', () => {
  it.for([
    ['today', '2026-10-01', true],
    ['13 days ago', '2026-09-18', true],
    ['exactly 14 days ago', '2026-09-17', true],
    ['15 days ago', '2026-09-16', false],
    ['3 months ago', '2026-06-26', false],
    ['1 day in the future', '2026-10-02', false]
  ] as const)('%s (%s) -> %s', ([_label, launchDate, expected]) => {
    expect(isRecentLaunch(launchDate, NOW)).toBe(expected)
  })

  it('ignores the time of day, only comparing calendar dates', () => {
    const lateInTheDay = new Date('2026-10-01T23:59:00Z')
    expect(isRecentLaunch('2026-10-01', lateInTheDay)).toBe(true)
  })
})

describe('drops', () => {
  it.for(drops)('$id has a parseable launchDate', (drop) => {
    expect(Number.isNaN(Date.parse(drop.launchDate))).toBe(false)
  })

  it('cards that open the local file catalogue do not promise partner models', () => {
    const localCatalogueCards = drops.filter((drop) =>
      Object.values(drop.cta.href).includes(getRoutes().models)
    )
    const promisingPartnerModels = localCatalogueCards.filter(
      (drop) =>
        /partner/i.test(drop.description.en) ||
        drop.description['zh-CN'].includes('合作伙伴')
    )

    expect(localCatalogueCards).not.toHaveLength(0)
    expect(promisingPartnerModels.map((drop) => drop.id)).toEqual([])
  })
})
