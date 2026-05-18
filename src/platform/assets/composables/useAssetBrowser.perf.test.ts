import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import * as assetMetadataUtils from '@/platform/assets/utils/assetMetadataUtils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  d: (date: Date) => date.toLocaleDateString()
}))

const ASSET_COUNT = 200
const CATEGORIES = ['inputs', 'outputs'] as const
const TAB_SWITCHES = 6

function makeAsset(index: number): AssetItem {
  const category = CATEGORIES[index % CATEGORIES.length]
  return {
    id: `asset-${index}`,
    name: `asset-${index}.safetensors`,
    asset_hash: `blake3:${index}`,
    size: 1024,
    mime_type: 'application/octet-stream',
    tags: ['models', category],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z',
    is_immutable: false
  }
}

describe('useAssetBrowser - filter tab switching perf (FE-229)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('does not re-transform every asset on each filter tab switch', async () => {
    const assets = Array.from({ length: ASSET_COUNT }, (_, i) => makeAsset(i))
    const filenameSpy = vi.spyOn(assetMetadataUtils, 'getAssetFilename')

    const { selectedNavItem, filteredAssets } = useAssetBrowser(ref(assets))

    // Initial materialization of the 'all' tab.
    void filteredAssets.value
    await nextTick()
    const baselineCalls = filenameSpy.mock.calls.length

    // Simulate the user clicking back and forth between All / Inputs / Outputs.
    const tabs: ('all' | 'inputs' | 'outputs')[] = [
      'inputs',
      'outputs',
      'all',
      'inputs',
      'outputs',
      'all'
    ]
    expect(tabs).toHaveLength(TAB_SWITCHES)

    for (const tab of tabs) {
      selectedNavItem.value = tab
      void filteredAssets.value
      await nextTick()
    }

    const switchCalls = filenameSpy.mock.calls.length - baselineCalls

    // Naive (no memoization) cost is approximately:
    //   inputs (100) + outputs (100) + all (200) + inputs (100) + outputs (100) + all (200) = 800.
    // With per-asset memoization the same asset object should never be transformed twice,
    // so total work across all tab switches must stay within a small multiple of ASSET_COUNT.
    const budget = ASSET_COUNT * 2
    expect(switchCalls).toBeLessThanOrEqual(budget)
  })

  it('returns identical display item references for unchanged assets across tab switches', async () => {
    const assets = Array.from({ length: ASSET_COUNT }, (_, i) => makeAsset(i))

    const { selectedNavItem, filteredAssets } = useAssetBrowser(ref(assets))

    const firstAllSnapshot = new Map(
      filteredAssets.value.map((item) => [item.id, item])
    )
    await nextTick()

    selectedNavItem.value = 'inputs'
    void filteredAssets.value
    await nextTick()

    selectedNavItem.value = 'all'
    const secondAll = filteredAssets.value
    await nextTick()

    // If transformAssetForDisplay is memoized per asset, the display items for
    // the unchanged underlying assets should be the very same object identity
    // when we navigate back to 'all'. Without memoization every re-render
    // produces brand-new objects, which forces downstream components
    // (AssetGrid / AssetCard) to re-render every card.
    const reusedReferences = secondAll.filter(
      (item) => firstAllSnapshot.get(item.id) === item
    ).length

    expect(reusedReferences).toBe(ASSET_COUNT)
  })
})
