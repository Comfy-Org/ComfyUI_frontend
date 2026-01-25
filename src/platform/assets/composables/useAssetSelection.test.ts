import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { useAssetSelection } from './useAssetSelection'
import { useAssetSelectionStore } from './useAssetSelectionStore'

vi.mock('@vueuse/core', () => ({
  useKeyModifier: vi.fn(() => ref(false))
}))

describe('useAssetSelection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('prunes selection to visible assets', () => {
    const selection = useAssetSelection()
    const store = useAssetSelectionStore()
    const assets: AssetItem[] = [
      { id: 'a', name: 'a.png', tags: [] },
      { id: 'b', name: 'b.png', tags: [] }
    ]

    store.setSelection(['a', 'b'])
    store.setLastSelectedIndex(1)
    store.setLastSelectedAssetId('b')

    selection.reconcileSelection([assets[1]])

    expect(Array.from(store.selectedAssetIds)).toEqual(['b'])
    expect(store.lastSelectedIndex).toBe(0)
    expect(store.lastSelectedAssetId).toBe('b')
  })

  it('clears selection when no visible assets remain', () => {
    const selection = useAssetSelection()
    const store = useAssetSelectionStore()

    store.setSelection(['a'])
    store.setLastSelectedIndex(0)
    store.setLastSelectedAssetId('a')

    selection.reconcileSelection([])

    expect(store.selectedAssetIds.size).toBe(0)
    expect(store.lastSelectedIndex).toBe(-1)
    expect(store.lastSelectedAssetId).toBeNull()
  })

  it('recomputes the anchor index when assets reorder', () => {
    const selection = useAssetSelection()
    const store = useAssetSelectionStore()
    const assets: AssetItem[] = [
      { id: 'a', name: 'a.png', tags: [] },
      { id: 'b', name: 'b.png', tags: [] }
    ]

    store.setSelection(['a'])
    store.setLastSelectedIndex(0)
    store.setLastSelectedAssetId('a')

    selection.reconcileSelection([assets[1], assets[0]])

    expect(store.lastSelectedIndex).toBe(1)
    expect(store.lastSelectedAssetId).toBe('a')
  })

  it('clears anchor when the anchored asset is no longer visible', () => {
    const selection = useAssetSelection()
    const store = useAssetSelectionStore()
    const assets: AssetItem[] = [
      { id: 'a', name: 'a.png', tags: [] },
      { id: 'b', name: 'b.png', tags: [] }
    ]

    store.setSelection(['a', 'b'])
    store.setLastSelectedIndex(0)
    store.setLastSelectedAssetId('a')

    selection.reconcileSelection([assets[1]])

    expect(Array.from(store.selectedAssetIds)).toEqual(['b'])
    expect(store.lastSelectedIndex).toBe(-1)
    expect(store.lastSelectedAssetId).toBeNull()
  })
})
