import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { AssetSortOption } from '../types/filterTypes'
import type { SortableItem } from './assetSortUtils'
import { sortAssets } from './assetSortUtils'

const arbISODate = fc
  .integer({ min: 1577836800000, max: 1893456000000 })
  .map((ms) => new Date(ms).toISOString())

const arbSortableItem: fc.Arbitrary<SortableItem> = fc.record({
  name: fc.stringMatching(/^[a-z0-9_]{1,12}\.[a-z]{2,5}$/),
  label: fc.option(fc.stringMatching(/^[A-Za-z0-9]{1,15}$/), {
    nil: undefined
  }),
  created_at: fc.option(arbISODate, { nil: undefined })
})

const arbSortOption: fc.Arbitrary<AssetSortOption> = fc.constantFrom(
  'default',
  'recent',
  'name-asc',
  'name-desc'
)

function getDisplayName(item: SortableItem): string {
  return item.label ?? item.name
}

describe('assetSortUtils properties', () => {
  it('sort never mutates the input array', () => {
    fc.assert(
      fc.property(
        fc.array(arbSortableItem, { maxLength: 30 }),
        arbSortOption,
        (items, sortBy) => {
          const original = [...items]
          sortAssets(items, sortBy)
          expect(items).toEqual(original)
        }
      )
    )
  })

  it('sorted output is always a permutation of the input', () => {
    fc.assert(
      fc.property(
        fc.array(arbSortableItem, { maxLength: 30 }),
        arbSortOption,
        (items, sortBy) => {
          const result = sortAssets(items, sortBy)
          expect(result.length).toBe(items.length)

          const inputNames = items.map((i) => i.name).sort()
          const resultNames = result.map((i) => i.name).sort()
          expect(resultNames).toEqual(inputNames)
        }
      )
    )
  })

  it('sorting is idempotent (sorting twice yields same result)', () => {
    fc.assert(
      fc.property(
        fc.array(arbSortableItem, { maxLength: 30 }),
        arbSortOption,
        (items, sortBy) => {
          const once = sortAssets(items, sortBy)
          const twice = sortAssets(once, sortBy)
          expect(twice.map((i) => i.name)).toEqual(once.map((i) => i.name))
        }
      )
    )
  })

  it('name-asc: adjacent elements satisfy comparator(a, b) <= 0', () => {
    fc.assert(
      fc.property(
        fc.array(arbSortableItem, { minLength: 2, maxLength: 30 }),
        (items) => {
          const sorted = sortAssets(items, 'name-asc')
          for (let i = 0; i < sorted.length - 1; i++) {
            const cmp = getDisplayName(sorted[i]).localeCompare(
              getDisplayName(sorted[i + 1]),
              undefined,
              { numeric: true, sensitivity: 'base' }
            )
            expect(cmp).toBeLessThanOrEqual(0)
          }
        }
      )
    )
  })

  it('name-desc: adjacent elements satisfy comparator(a, b) >= 0', () => {
    fc.assert(
      fc.property(
        fc.array(arbSortableItem, { minLength: 2, maxLength: 30 }),
        (items) => {
          const sorted = sortAssets(items, 'name-desc')
          for (let i = 0; i < sorted.length - 1; i++) {
            const cmp = getDisplayName(sorted[i]).localeCompare(
              getDisplayName(sorted[i + 1]),
              undefined,
              { numeric: true, sensitivity: 'base' }
            )
            expect(cmp).toBeGreaterThanOrEqual(0)
          }
        }
      )
    )
  })

  it('recent: adjacent elements satisfy a.created_at >= b.created_at', () => {
    fc.assert(
      fc.property(
        fc.array(arbSortableItem, { minLength: 2, maxLength: 30 }),
        (items) => {
          const sorted = sortAssets(items, 'recent')
          for (let i = 0; i < sorted.length - 1; i++) {
            const a = new Date(sorted[i].created_at ?? 0).getTime()
            const b = new Date(sorted[i + 1].created_at ?? 0).getTime()
            expect(a).toBeGreaterThanOrEqual(b)
          }
        }
      )
    )
  })

  it('default preserves original order', () => {
    fc.assert(
      fc.property(fc.array(arbSortableItem, { maxLength: 30 }), (items) => {
        const result = sortAssets(items, 'default')
        expect(result.map((i) => i.name)).toEqual(items.map((i) => i.name))
      })
    )
  })

  it('sort output length equals input length for all sort options', () => {
    fc.assert(
      fc.property(
        fc.array(arbSortableItem, { maxLength: 30 }),
        arbSortOption,
        (items, sortBy) => {
          const result = sortAssets(items, sortBy)
          expect(result.length).toBe(items.length)
        }
      )
    )
  })
})
