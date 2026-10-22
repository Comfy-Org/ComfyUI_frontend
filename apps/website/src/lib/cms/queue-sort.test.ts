import { describe, expect, it } from 'vitest'
import type { CatalogQueueItem } from './queue'
import { canSortByLatest, sortQueue } from './queue-sort'

function row(id: string, title: string, savedAt?: string): CatalogQueueItem {
  return {
    source: 'catalog',
    id,
    title,
    change: 'updated',
    kind: 'WORKFLOW',
    slug: id,
    hidden: false,
    savedAt,
    fields: [],
    gaps: []
  }
}

describe('Draft change list order', () => {
  const items = [
    row('c', 'beta workflow', '2026-10-20T10:00:00Z'),
    row('a', 'Alpha 10', '2026-10-20T09:00:00Z'),
    row('b', 'alpha 2'),
    row('d', 'Gamma', '2026-10-20T11:30:00-07:00')
  ]

  it('defaults to a natural, case-insensitive name order', () => {
    expect(sortQueue(items, 'NAME').map((item) => item.title)).toEqual([
      'alpha 2',
      'Alpha 10',
      'beta workflow',
      'Gamma'
    ])
  })

  it('puts the latest save first and unsaved-time items last by name', () => {
    expect(sortQueue(items, 'LATEST').map((item) => item.id)).toEqual([
      'd',
      'c',
      'a',
      'b'
    ])
  })

  it('breaks equal save times by name and never mutates the input', () => {
    const same = '2026-10-20T10:00:00Z'
    const tied = [row('y', 'Zulu', same), row('x', 'Echo', same)]
    expect(sortQueue(tied, 'LATEST').map((item) => item.title)).toEqual([
      'Echo',
      'Zulu'
    ])
    expect(tied.map((item) => item.title)).toEqual(['Zulu', 'Echo'])
  })

  it('offers latest-first only when some item reports a valid save time', () => {
    expect(canSortByLatest(items)).toBe(true)
    expect(canSortByLatest([row('a', 'A'), row('b', 'B', 'not a time')])).toBe(
      false
    )
  })
})
