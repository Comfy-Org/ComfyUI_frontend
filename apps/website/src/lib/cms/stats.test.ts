import { describe, expect, it } from 'vitest'

import { byPopularity, compactCount, itemStats } from './stats'

describe('itemStats', () => {
  it('reads the numbers and ignores anything else', () => {
    expect(
      itemStats({ popularity: 12, downloads: '4', runs: -1, name: 'x' })
    ).toEqual({ popularity: 12, downloads: undefined, runs: undefined })
  })
})

describe('byPopularity', () => {
  it('puts the most popular first and keeps the rest in order', () => {
    const rows = [
      { id: 'a', stats: {} },
      { id: 'b', stats: { popularity: 5 } },
      { id: 'c', stats: {} },
      { id: 'd', stats: { popularity: 9 } }
    ]
    expect(byPopularity(rows).map(({ id }) => id)).toEqual(['d', 'b', 'a', 'c'])
  })
})

describe('compactCount', () => {
  it('shortens large numbers', () => {
    expect(compactCount(12_400, 'en')).toBe('12.4K')
  })
})
