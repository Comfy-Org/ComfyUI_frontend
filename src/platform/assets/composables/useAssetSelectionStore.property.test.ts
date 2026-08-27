import { fromPartial } from '@total-typescript/shoehorn'

import * as fc from 'fast-check'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

vi.mock('@/platform/assets/composables/media/assetMappers', () => ({
  mapInputFileToAssetItem: vi.fn(),
  mapTaskOutputToAssetItem: vi.fn()
}))

import { useAssetSelectionStore } from './useAssetSelectionStore'

const arbAssetId = fc.stringMatching(/^[a-z0-9]{4,12}$/)

function arbAssets(minLength = 1, maxLength = 20): fc.Arbitrary<AssetItem[]> {
  return fc
    .uniqueArray(arbAssetId, { minLength, maxLength })
    .map((ids) =>
      ids.map((id) =>
        fromPartial<AssetItem>({ id, name: `${id}.png`, tags: [] })
      )
    )
}

describe('useAssetSelectionStore properties', () => {
  describe('reconcileSelection', () => {
    it('after reconcile, selected IDs are always within visible assets', () => {
      fc.assert(
        fc.property(
          arbAssets(1, 15),
          arbAssets(1, 15),
          (initialAssets, visibleAssets) => {
            setActivePinia(createPinia())
            const store = useAssetSelectionStore()

            store.setSelection(initialAssets.map((a) => a.id))
            store.reconcileSelection(visibleAssets)

            const visibleIds = new Set(visibleAssets.map((a) => a.id))
            for (const id of store.selectedAssetIds) {
              expect(visibleIds.has(id)).toBe(true)
            }
          }
        )
      )
    })

    it('reconcile never adds new IDs that were not previously selected', () => {
      fc.assert(
        fc.property(
          arbAssets(1, 15),
          arbAssets(1, 15),
          (initialAssets, visibleAssets) => {
            setActivePinia(createPinia())
            const store = useAssetSelectionStore()

            const initialIds = new Set(initialAssets.map((a) => a.id))
            store.setSelection([...initialIds])

            store.reconcileSelection(visibleAssets)

            for (const id of store.selectedAssetIds) {
              expect(initialIds.has(id)).toBe(true)
            }
          }
        )
      )
    })

    it('reconcile with superset of selected assets preserves all selections', () => {
      fc.assert(
        fc.property(arbAssets(1, 15), (assets) => {
          setActivePinia(createPinia())
          const store = useAssetSelectionStore()

          const selectedIds = assets.map((a) => a.id)
          store.setSelection(selectedIds)

          store.reconcileSelection(assets)

          expect(store.selectedAssetIds.size).toBe(selectedIds.length)
        })
      )
    })

    it('reconcile with empty visible assets clears selection', () => {
      fc.assert(
        fc.property(arbAssets(1, 15), (initialAssets) => {
          setActivePinia(createPinia())
          const store = useAssetSelectionStore()

          store.setSelection(initialAssets.map((a) => a.id))
          store.reconcileSelection([])

          expect(store.selectedAssetIds.size).toBe(0)
        })
      )
    })
  })

  describe('selectAll', () => {
    it('selectAll then getSelectedAssets returns all assets', () => {
      fc.assert(
        fc.property(arbAssets(0, 20), (assets) => {
          setActivePinia(createPinia())
          const store = useAssetSelectionStore()

          store.selectAll(assets)
          const selected = store.getSelectedAssets(assets)

          expect(selected.length).toBe(assets.length)
        })
      )
    })
  })

  describe('getOutputCount / getTotalOutputCount', () => {
    it('getOutputCount always returns >= 1', () => {
      const arbAssetWithMeta: fc.Arbitrary<AssetItem> = fc
        .record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 10 }),
          tags: fc.constant<string[]>([]),
          user_metadata: fc.option(
            fc.record({
              outputCount: fc.oneof(
                fc.integer(),
                fc.constant(undefined),
                fc.constant(null)
              )
            }),
            { nil: undefined }
          )
        })
        .map((r) => fromPartial<AssetItem>(r))

      fc.assert(
        fc.property(arbAssetWithMeta, (asset) => {
          setActivePinia(createPinia())
          const store = useAssetSelectionStore()
          expect(store.getOutputCount(asset)).toBeGreaterThanOrEqual(1)
        })
      )
    })

    it('getTotalOutputCount >= number of assets', () => {
      const arbAssetWithMeta: fc.Arbitrary<AssetItem> = fc
        .record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 10 }),
          tags: fc.constant<string[]>([]),
          user_metadata: fc.option(
            fc.record({
              outputCount: fc.oneof(
                fc.integer({ min: 1, max: 100 }),
                fc.constant(undefined)
              )
            }),
            { nil: undefined }
          )
        })
        .map((r) => fromPartial<AssetItem>(r))

      fc.assert(
        fc.property(fc.array(arbAssetWithMeta, { maxLength: 20 }), (assets) => {
          setActivePinia(createPinia())
          const store = useAssetSelectionStore()
          expect(store.getTotalOutputCount(assets)).toBeGreaterThanOrEqual(
            assets.length
          )
        })
      )
    })
  })
})
