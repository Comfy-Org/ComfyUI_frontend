import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { OwnershipOption } from '@/platform/assets/types/filterTypes'

import {
  filterByCategory,
  filterByFileFormats,
  filterByOwnership,
  filterItemByBaseModels,
  filterItemByOwnership
} from './assetFilterUtils'

const arbAssetItem: fc.Arbitrary<AssetItem> = fc.record({
  id: fc.uuid(),
  name: fc.stringMatching(/^[a-z0-9_-]{1,12}\.[a-z]{2,6}$/),
  tags: fc.array(fc.stringMatching(/^[a-z0-9/]{1,15}$/), { maxLength: 5 }),
  is_immutable: fc.boolean(),
  metadata: fc.option(
    fc.record({
      base_model: fc.array(fc.stringMatching(/^[A-Z0-9.]{1,8}$/), {
        maxLength: 3
      })
    }),
    { nil: undefined }
  ),
  user_metadata: fc.option(
    fc.record({
      base_model: fc.array(fc.stringMatching(/^[A-Z0-9.]{1,8}$/), {
        maxLength: 3
      })
    }),
    { nil: undefined }
  )
})

const arbOwnership: fc.Arbitrary<OwnershipOption> = fc.constantFrom(
  'all',
  'my-models',
  'public-models'
)

describe('assetFilterUtils properties', () => {
  it('filterByCategory("all") accepts every asset', () => {
    fc.assert(
      fc.property(arbAssetItem, (asset) => {
        expect(filterByCategory('all')(asset)).toBe(true)
      })
    )
  })

  it('filtered result is always a subset of the input', () => {
    fc.assert(
      fc.property(
        fc.array(arbAssetItem, { maxLength: 30 }),
        fc.stringMatching(/^[a-z]{1,8}$/),
        (assets, category) => {
          const filter = filterByCategory(category)
          const result = assets.filter(filter)
          expect(result.length).toBeLessThanOrEqual(assets.length)
          for (const item of result) {
            expect(assets).toContain(item)
          }
        }
      )
    )
  })

  it('filterByFileFormats with empty formats accepts every asset', () => {
    fc.assert(
      fc.property(arbAssetItem, (asset) => {
        expect(filterByFileFormats([])(asset)).toBe(true)
      })
    )
  })

  it('filterByFileFormats result is a subset of the input', () => {
    fc.assert(
      fc.property(
        fc.array(arbAssetItem, { maxLength: 30 }),
        fc.array(fc.stringMatching(/^[a-z]{2,6}$/), { maxLength: 5 }),
        (assets, formats) => {
          const filter = filterByFileFormats(formats)
          const result = assets.filter(filter)
          expect(result.length).toBeLessThanOrEqual(assets.length)
        }
      )
    )
  })

  it('filterByOwnership("all") accepts every asset', () => {
    fc.assert(
      fc.property(arbAssetItem, (asset) => {
        expect(filterByOwnership('all')(asset)).toBe(true)
      })
    )
  })

  it('filterByOwnership partitions assets: my-models + public-models = all', () => {
    fc.assert(
      fc.property(fc.array(arbAssetItem, { maxLength: 30 }), (assets) => {
        const mine = assets.filter(filterByOwnership('my-models'))
        const pub = assets.filter(filterByOwnership('public-models'))
        const all = assets.filter(filterByOwnership('all'))

        expect(mine.length + pub.length).toBe(all.length)
      })
    )
  })

  it('filterItemByOwnership result is a subset of the input', () => {
    const arbItem = fc.record({
      id: fc.uuid(),
      is_immutable: fc.boolean()
    })

    fc.assert(
      fc.property(
        fc.array(arbItem, { maxLength: 30 }),
        arbOwnership,
        (items, ownership) => {
          const result = filterItemByOwnership(items, ownership)
          expect(result.length).toBeLessThanOrEqual(items.length)
          for (const item of result) {
            expect(items).toContain(item)
          }
        }
      )
    )
  })

  it('filterItemByOwnership("all") returns all items', () => {
    const arbItem = fc.record({
      id: fc.uuid(),
      is_immutable: fc.boolean()
    })

    fc.assert(
      fc.property(fc.array(arbItem, { maxLength: 30 }), (items) => {
        const result = filterItemByOwnership(items, 'all')
        expect(result).toEqual(items)
      })
    )
  })

  it('filterItemByBaseModels with empty set returns all items', () => {
    const arbItem = fc.record({
      id: fc.uuid(),
      base_models: fc.option(
        fc.array(fc.stringMatching(/^[A-Z0-9.]{1,8}$/), { maxLength: 3 }),
        { nil: undefined }
      )
    })

    fc.assert(
      fc.property(fc.array(arbItem, { maxLength: 30 }), (items) => {
        const result = filterItemByBaseModels(items, new Set<string>())
        expect(result).toEqual(items)
      })
    )
  })

  it('filterItemByBaseModels result is a subset of the input', () => {
    const arbItem = fc.record({
      id: fc.uuid(),
      base_models: fc.option(
        fc.array(fc.stringMatching(/^[A-Z0-9.]{1,8}$/), { maxLength: 3 }),
        { nil: undefined }
      )
    })

    fc.assert(
      fc.property(
        fc.array(arbItem, { maxLength: 30 }),
        fc.array(fc.stringMatching(/^[A-Z0-9.]{1,8}$/), { maxLength: 5 }),
        (items, models) => {
          const result = filterItemByBaseModels(items, new Set(models))
          expect(result.length).toBeLessThanOrEqual(items.length)
          for (const item of result) {
            expect(items).toContain(item)
          }
        }
      )
    )
  })
})
