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

    selection.reconcileSelection([assets[1]])

    expect(Array.from(store.selectedAssetIds)).toEqual(['b'])
    expect(store.lastSelectedIndex).toBe(-1)
  })

  it('clears selection when no visible assets remain', () => {
    const selection = useAssetSelection()
    const store = useAssetSelectionStore()

    store.setSelection(['a'])
    store.setLastSelectedIndex(0)

    selection.reconcileSelection([])

    expect(store.selectedAssetIds.size).toBe(0)
    expect(store.lastSelectedIndex).toBe(-1)
  })
})
