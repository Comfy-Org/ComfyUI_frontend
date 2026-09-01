import * as fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

vi.mock('@/platform/assets/utils/outputAssetUtil', () => ({
  getOutputKey: () => null,
  resolveOutputAssetItems: () => Promise.resolve([])
}))

vi.mock('@/platform/assets/schemas/assetMetadataSchema', () => ({
  getOutputAssetMetadata: (metadata: Record<string, unknown> | undefined) => {
    if (
      metadata &&
      typeof metadata.jobId === 'string' &&
      (typeof metadata.nodeId === 'string' ||
        typeof metadata.nodeId === 'number')
    ) {
      return metadata
    }
    return null
  }
}))

import { useOutputStacks } from './useOutputStacks'

const arbAssetId = fc.stringMatching(/^[a-z0-9]{4,12}$/)

function arbAssetList(
  minLength = 0,
  maxLength = 20
): fc.Arbitrary<AssetItem[]> {
  return fc.uniqueArray(arbAssetId, { minLength, maxLength }).map((ids) =>
    ids.map(
      (id) =>
        ({
          id,
          name: `${id}.png`,
          tags: ['output']
        }) satisfies AssetItem
    )
  )
}

describe('useOutputStacks properties', () => {
  it('collapsed stacks: item count equals input asset count', () => {
    fc.assert(
      fc.property(arbAssetList(0, 30), (assets) => {
        const assetsRef = ref(assets)
        const { assetItems } = useOutputStacks({ assets: assetsRef })

        expect(assetItems.value.length).toBe(assets.length)
      })
    )
  })

  it('every item in assetItems references an asset from the input', () => {
    fc.assert(
      fc.property(arbAssetList(0, 30), (assets) => {
        const assetsRef = ref(assets)
        const { assetItems } = useOutputStacks({ assets: assetsRef })

        const inputIds = new Set(assets.map((a) => a.id))
        for (const item of assetItems.value) {
          expect(inputIds.has(item.asset.id)).toBe(true)
        }
      })
    )
  })

  it('all items have unique keys', () => {
    fc.assert(
      fc.property(arbAssetList(0, 30), (assets) => {
        const assetsRef = ref(assets)
        const { assetItems } = useOutputStacks({ assets: assetsRef })

        const keys = assetItems.value.map((item) => item.key)
        expect(new Set(keys).size).toBe(keys.length)
      })
    )
  })

  it('selectableAssets length matches assetItems length', () => {
    fc.assert(
      fc.property(arbAssetList(0, 30), (assets) => {
        const assetsRef = ref(assets)
        const { assetItems, selectableAssets } = useOutputStacks({
          assets: assetsRef
        })

        expect(selectableAssets.value.length).toBe(assetItems.value.length)
      })
    )
  })

  it('no collapsed item is marked as a child', () => {
    fc.assert(
      fc.property(arbAssetList(0, 30), (assets) => {
        const assetsRef = ref(assets)
        const { assetItems } = useOutputStacks({ assets: assetsRef })

        for (const item of assetItems.value) {
          expect(item.isChild).toBeUndefined()
        }
      })
    )
  })

  it('isStackExpanded returns false for assets without job metadata', () => {
    fc.assert(
      fc.property(arbAssetList(1, 20), (assets) => {
        const assetsRef = ref(assets)
        const { isStackExpanded } = useOutputStacks({ assets: assetsRef })

        for (const asset of assets) {
          expect(isStackExpanded(asset)).toBe(false)
        }
      })
    )
  })

  it('reactively updates when assets ref changes', () => {
    fc.assert(
      fc.property(
        arbAssetList(1, 15),
        arbAssetList(1, 15),
        (assetsA, assetsB) => {
          const assetsRef = ref(assetsA)
          const { assetItems } = useOutputStacks({ assets: assetsRef })

          expect(assetItems.value.length).toBe(assetsA.length)

          assetsRef.value = assetsB
          expect(assetItems.value.length).toBe(assetsB.length)
        }
      )
    )
  })
})
