import { describe, expect, it } from 'vitest'

import { compactCount, itemStats, sortRows } from './stats'

describe('itemStats', () => {
  it('reads the numbers and ignores anything else', () => {
    expect(
      itemStats({ popularity: 12, downloads: '4', runs: -1, name: 'x' })
    ).toEqual({ popularity: 12, downloads: undefined, runs: undefined })
  })
})

describe('sortRows', () => {
  const rows = [
    { title: 'Beta', stats: {} },
    { title: 'alpha', stats: { popularity: 5 } },
    { title: 'Gamma', stats: {} },
    { title: 'Delta', stats: { popularity: 9 } }
  ]
  const titles = (sorted: typeof rows) => sorted.map(({ title }) => title)

  it('puts the most popular first and rows without a score last, in order', () => {
    expect(
      titles(sortRows(rows, { key: 'popularity', descending: true }))
    ).toEqual(['Delta', 'alpha', 'Beta', 'Gamma'])
  })

  it('keeps rows without a score last when sorting up', () => {
    expect(
      titles(sortRows(rows, { key: 'popularity', descending: false }))
    ).toEqual(['alpha', 'Delta', 'Beta', 'Gamma'])
  })

  it('sorts names alphabetically, ignoring case', () => {
    expect(titles(sortRows(rows, { key: 'name', descending: false }))).toEqual([
      'alpha',
      'Beta',
      'Delta',
      'Gamma'
    ])
  })
})

describe('compactCount', () => {
  it('shortens large numbers', () => {
    expect(compactCount(12_400, 'en')).toBe('12.4K')
  })
})
