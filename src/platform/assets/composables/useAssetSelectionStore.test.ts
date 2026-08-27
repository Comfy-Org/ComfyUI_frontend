import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { SelectionModifiers } from '@/platform/assets/utils/selectionModifiers'

vi.mock('@/platform/assets/composables/media/assetMappers', () => ({
  mapInputFileToAssetItem: vi.fn(),
  mapTaskOutputToAssetItem: vi.fn()
}))

import { useAssetSelectionStore } from './useAssetSelectionStore'

const noMods: SelectionModifiers = { shift: false, cmdOrCtrl: false }
const shift: SelectionModifiers = { shift: true, cmdOrCtrl: false }
const cmdOrCtrl: SelectionModifiers = { shift: false, cmdOrCtrl: true }

function createMockAssets(count: number): AssetItem[] {
  return Array.from(
    { length: count },
    (_, i): AssetItem =>
      fromPartial({
        id: `asset-${i}`,
        name: `Asset ${i}`,
        size: 1000,
        created_at: new Date().toISOString(),
        tags: ['output'],
        preview_url: `http://example.com/asset-${i}.png`
      })
  )
}

describe('useAssetSelectionStore', () => {
  describe('reconcileSelection', () => {
    it('prunes selection to visible assets', () => {
      const store = useAssetSelectionStore()
      const assets: AssetItem[] = [
        fromPartial({ id: 'a', name: 'a.png', tags: [] }),
        fromPartial({ id: 'b', name: 'b.png', tags: [] })
      ]

      store.setSelection(['a', 'b'])
      store.setLastSelectedIndex(1)
      store.setLastSelectedAssetId('b')

      store.reconcileSelection([assets[1]])

      expect(Array.from(store.selectedAssetIds)).toEqual(['b'])
      expect(store.lastSelectedIndex).toBe(0)
      expect(store.lastSelectedAssetId).toBe('b')
    })

    it('clears selection when no visible assets remain', () => {
      const store = useAssetSelectionStore()

      store.setSelection(['a'])
      store.setLastSelectedIndex(0)
      store.setLastSelectedAssetId('a')

      store.reconcileSelection([])

      expect(store.selectedAssetIds.size).toBe(0)
      expect(store.lastSelectedIndex).toBe(-1)
      expect(store.lastSelectedAssetId).toBeNull()
    })

    it('recomputes the anchor index when assets reorder', () => {
      const store = useAssetSelectionStore()
      const assets: AssetItem[] = [
        fromPartial({ id: 'a', name: 'a.png', tags: [] }),
        fromPartial({ id: 'b', name: 'b.png', tags: [] })
      ]

      store.setSelection(['a'])
      store.setLastSelectedIndex(0)
      store.setLastSelectedAssetId('a')

      store.reconcileSelection([assets[1], assets[0]])

      expect(store.lastSelectedIndex).toBe(1)
      expect(store.lastSelectedAssetId).toBe('a')
    })

    it('clears anchor when the anchored asset is no longer visible', () => {
      const store = useAssetSelectionStore()
      const assets: AssetItem[] = [
        fromPartial({ id: 'a', name: 'a.png', tags: [] }),
        fromPartial({ id: 'b', name: 'b.png', tags: [] })
      ]

      store.setSelection(['a', 'b'])
      store.setLastSelectedIndex(0)
      store.setLastSelectedAssetId('a')

      store.reconcileSelection([assets[1]])

      expect(Array.from(store.selectedAssetIds)).toEqual(['b'])
      expect(store.lastSelectedIndex).toBe(-1)
      expect(store.lastSelectedAssetId).toBeNull()
    })
  })

  describe('handleAssetClick - normal click', () => {
    it('selects single asset and clears previous selection', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.selectedCount).toBe(1)

      store.handleAssetClick(assets[1], 1, assets, noMods)
      expect(store.isSelected('asset-0')).toBe(false)
      expect(store.isSelected('asset-1')).toBe(true)
      expect(store.selectedCount).toBe(1)
    })

    it('keeps the only selected asset selected when clicked again', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      store.handleAssetClick(assets[0], 0, assets, noMods)

      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.selectedCount).toBe(1)
    })

    it('collapses a multi-selection to the clicked asset', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      store.handleAssetClick(assets[1], 1, assets, cmdOrCtrl)

      store.handleAssetClick(assets[0], 0, assets, noMods)

      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.isSelected('asset-1')).toBe(false)
      expect(store.selectedCount).toBe(1)
    })
  })

  describe('handleAssetClick - shift+click', () => {
    it('selects range from anchor to clicked item', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(5)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      store.handleAssetClick(assets[2], 2, assets, shift)

      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.isSelected('asset-1')).toBe(true)
      expect(store.isSelected('asset-2')).toBe(true)
      expect(store.selectedCount).toBe(3)
    })

    it('replaces selection when shift+clicking smaller range (bug fix)', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(5)

      store.handleAssetClick(assets[0], 0, assets, noMods)

      store.handleAssetClick(assets[2], 2, assets, shift)
      expect(store.selectedCount).toBe(3)

      store.handleAssetClick(assets[0], 0, assets, shift)
      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.isSelected('asset-1')).toBe(false)
      expect(store.isSelected('asset-2')).toBe(false)
      expect(store.selectedCount).toBe(1)
    })

    it('works in reverse direction', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(5)

      store.handleAssetClick(assets[2], 2, assets, noMods)
      store.handleAssetClick(assets[0], 0, assets, shift)

      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.isSelected('asset-1')).toBe(true)
      expect(store.isSelected('asset-2')).toBe(true)
      expect(store.selectedCount).toBe(3)
    })
  })

  describe('handleAssetClick - ctrl/cmd+click', () => {
    it('toggles individual selection without clearing others', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      store.handleAssetClick(assets[2], 2, assets, cmdOrCtrl)

      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.isSelected('asset-2')).toBe(true)
      expect(store.selectedCount).toBe(2)
    })

    it('can deselect with ctrl+click', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      store.handleAssetClick(assets[0], 0, assets, cmdOrCtrl)

      expect(store.isSelected('asset-0')).toBe(false)
      expect(store.selectedCount).toBe(0)
    })
  })

  describe('toggleAssetSelection', () => {
    it('removes one asset without clearing the rest of the selection', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.selectAll(assets)
      store.toggleAssetSelection(assets[1], 1, assets)

      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.isSelected('asset-1')).toBe(false)
      expect(store.isSelected('asset-2')).toBe(true)
      expect(store.selectedCount).toBe(2)
    })

    it('adds one asset without clearing the rest of the selection', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      store.toggleAssetSelection(assets[1], 1, assets)

      expect(store.isSelected('asset-0')).toBe(true)
      expect(store.isSelected('asset-1')).toBe(true)
      expect(store.selectedCount).toBe(2)
    })
  })

  describe('setSelectedIds', () => {
    it('replaces selection and anchors on the last selected asset', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(5)

      store.setSelectedIds(['asset-1', 'asset-3'], assets)

      expect(Array.from(store.selectedAssetIds).sort()).toEqual([
        'asset-1',
        'asset-3'
      ])
      expect(store.lastSelectedIndex).toBe(3)
      expect(store.lastSelectedAssetId).toBe('asset-3')
    })

    it('clears the anchor when the selection is empty', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)
      store.setLastSelectedIndex(2)
      store.setLastSelectedAssetId('asset-2')

      store.setSelectedIds([], assets)

      expect(store.lastSelectedIndex).toBe(-1)
      expect(store.lastSelectedAssetId).toBeNull()
    })
  })

  describe('focusAsset', () => {
    it('switches source and selects the asset as the anchor', () => {
      const store = useAssetSelectionStore()

      store.focusAsset('job-1', { source: 'output' })

      expect(store.activeSource).toBe('output')
      expect(Array.from(store.selectedAssetIds)).toEqual(['job-1'])
      expect(store.lastSelectedAssetId).toBe('job-1')
    })

    it('resolves the anchor index once the asset is paged in', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.focusAsset('asset-2', { source: 'output' })
      expect(store.lastSelectedIndex).toBe(-1)

      store.reconcileSelection(assets)

      expect(store.isSelected('asset-2')).toBe(true)
      expect(store.lastSelectedIndex).toBe(2)
    })

    it('is pruned when the focused asset is absent from the source', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.focusAsset('missing-job', { source: 'output' })
      store.reconcileSelection(assets)

      expect(store.selectedCount).toBe(0)
    })
  })

  describe('clearSelection', () => {
    it('clears all selections', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[0], 0, assets, noMods)
      store.clearSelection()
      expect(store.selectedCount).toBe(0)
    })
  })

  describe('getSelectedAssets', () => {
    it('returns selected asset objects', () => {
      const store = useAssetSelectionStore()
      const assets = createMockAssets(3)

      store.handleAssetClick(assets[1], 1, assets, noMods)
      const selected = store.getSelectedAssets(assets)

      expect(selected).toHaveLength(1)
      expect(selected[0].id).toBe('asset-1')
    })
  })
})
