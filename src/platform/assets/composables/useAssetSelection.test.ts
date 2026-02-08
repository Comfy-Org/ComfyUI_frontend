import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

// Mock useKeyModifier before importing the composable
const mockShiftKey = ref(false)
const mockCtrlKey = ref(false)
const mockMetaKey = ref(false)

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useKeyModifier: (key: string) => {
      if (key === 'Shift') return mockShiftKey
      if (key === 'Control') return mockCtrlKey
      if (key === 'Meta') return mockMetaKey
      return ref(false)
    }
  }
})

import { useAssetSelection } from './useAssetSelection'
import { useAssetSelectionStore } from './useAssetSelectionStore'

function createMockAssets(count: number): AssetItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `asset-${i}`,
    name: `Asset ${i}`,
    size: 1000,
    created_at: new Date().toISOString(),
    tags: ['output'],
    preview_url: `http://example.com/asset-${i}.png`
  }))
}

type OutputStub = {
  filename: string
  nodeId: string
  subfolder: string
  url: string
}

function createOutputAsset(
  id: string,
  name: string,
  metadata: Record<string, unknown>
): AssetItem {
  return {
    id,
    name,
    tags: ['output'],
    user_metadata: metadata
  }
}

function createOutput(
  filename: string,
  nodeId: string,
  subfolder: string
): OutputStub {
  return {
    filename,
    nodeId,
    subfolder,
    url: `https://example.com/${filename}`
  }
}

describe('useAssetSelection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockShiftKey.value = false
    mockCtrlKey.value = false
    mockMetaKey.value = false
  })

  describe('reconcileSelection', () => {
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

  describe('handleAssetClick - normal click', () => {
    it('selects single asset and clears previous selection', () => {
      const { handleAssetClick, isSelected, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(3)

      handleAssetClick(assets[0], 0, assets)
      expect(isSelected('asset-0')).toBe(true)
      expect(selectedCount.value).toBe(1)

      handleAssetClick(assets[1], 1, assets)
      expect(isSelected('asset-0')).toBe(false)
      expect(isSelected('asset-1')).toBe(true)
      expect(selectedCount.value).toBe(1)
    })
  })

  describe('handleAssetClick - shift+click', () => {
    it('selects range from anchor to clicked item', () => {
      const { handleAssetClick, isSelected, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(5)

      // Click first item (sets anchor)
      handleAssetClick(assets[0], 0, assets)

      // Shift+click third item
      mockShiftKey.value = true
      handleAssetClick(assets[2], 2, assets)

      expect(isSelected('asset-0')).toBe(true)
      expect(isSelected('asset-1')).toBe(true)
      expect(isSelected('asset-2')).toBe(true)
      expect(selectedCount.value).toBe(3)
    })

    it('replaces selection when shift+clicking smaller range (bug fix)', () => {
      const { handleAssetClick, isSelected, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(5)

      // Click first item
      handleAssetClick(assets[0], 0, assets)

      // Shift+click third item -> selects 0,1,2
      mockShiftKey.value = true
      handleAssetClick(assets[2], 2, assets)
      expect(selectedCount.value).toBe(3)

      // Shift+click first item again -> should select only 0 (not 0,1,2)
      handleAssetClick(assets[0], 0, assets)
      expect(isSelected('asset-0')).toBe(true)
      expect(isSelected('asset-1')).toBe(false)
      expect(isSelected('asset-2')).toBe(false)
      expect(selectedCount.value).toBe(1)
    })

    it('works in reverse direction', () => {
      const { handleAssetClick, isSelected, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(5)

      // Click third item (sets anchor)
      handleAssetClick(assets[2], 2, assets)

      // Shift+click first item
      mockShiftKey.value = true
      handleAssetClick(assets[0], 0, assets)

      expect(isSelected('asset-0')).toBe(true)
      expect(isSelected('asset-1')).toBe(true)
      expect(isSelected('asset-2')).toBe(true)
      expect(selectedCount.value).toBe(3)
    })
  })

  describe('handleAssetClick - ctrl/cmd+click', () => {
    it('toggles individual selection without clearing others', () => {
      const { handleAssetClick, isSelected, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(3)

      handleAssetClick(assets[0], 0, assets)

      mockCtrlKey.value = true
      handleAssetClick(assets[2], 2, assets)

      expect(isSelected('asset-0')).toBe(true)
      expect(isSelected('asset-2')).toBe(true)
      expect(selectedCount.value).toBe(2)
    })

    it('can deselect with ctrl+click', () => {
      const { handleAssetClick, isSelected, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(3)

      handleAssetClick(assets[0], 0, assets)
      mockCtrlKey.value = true
      handleAssetClick(assets[0], 0, assets)

      expect(isSelected('asset-0')).toBe(false)
      expect(selectedCount.value).toBe(0)
    })

    it('toggles with meta key (macOS)', () => {
      const { handleAssetClick, isSelected, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(3)

      handleAssetClick(assets[0], 0, assets)

      mockMetaKey.value = true
      handleAssetClick(assets[2], 2, assets)

      expect(isSelected('asset-0')).toBe(true)
      expect(isSelected('asset-2')).toBe(true)
      expect(selectedCount.value).toBe(2)
    })
  })

  describe('selectAll', () => {
    it('selects all assets', () => {
      const { selectAll, selectedCount } = useAssetSelection()
      const assets = createMockAssets(5)

      selectAll(assets)
      expect(selectedCount.value).toBe(5)
    })
  })

  describe('clearSelection', () => {
    it('clears all selections', () => {
      const { handleAssetClick, clearSelection, selectedCount } =
        useAssetSelection()
      const assets = createMockAssets(3)

      handleAssetClick(assets[0], 0, assets)
      clearSelection()
      expect(selectedCount.value).toBe(0)
    })
  })

  describe('getSelectedAssets', () => {
    it('returns selected asset objects', () => {
      const { handleAssetClick, getSelectedAssets } = useAssetSelection()
      const assets = createMockAssets(3)

      handleAssetClick(assets[1], 1, assets)
      const selected = getSelectedAssets(assets)

      expect(selected).toHaveLength(1)
      expect(selected[0].id).toBe('asset-1')
    })
  })

  describe('getTotalOutputCount', () => {
    it('deduplicates overlapping parent stack and selected children with partial parent outputs', () => {
      const { getTotalOutputCount } = useAssetSelection()
      const outputs = [createOutput('parent.png', '1', 'outputs')]

      const parent = createOutputAsset('parent', 'parent.png', {
        promptId: 'prompt-1',
        nodeId: '1',
        subfolder: 'outputs',
        outputCount: 4,
        allOutputs: outputs
      })

      const child1 = createOutputAsset('child-1', 'child-1.png', {
        promptId: 'prompt-1',
        nodeId: '2',
        subfolder: 'outputs'
      })
      const child2 = createOutputAsset('child-2', 'child-2.png', {
        promptId: 'prompt-1',
        nodeId: '3',
        subfolder: 'outputs'
      })
      const child3 = createOutputAsset('child-3', 'child-3.png', {
        promptId: 'prompt-1',
        nodeId: '4',
        subfolder: 'outputs'
      })

      expect(getTotalOutputCount([parent, child1, child2, child3])).toBe(4)
    })

    it('deduplicates when parent includes full output list', () => {
      const { getTotalOutputCount } = useAssetSelection()
      const parent = createOutputAsset('parent', 'parent.png', {
        promptId: 'prompt-1',
        nodeId: '1',
        subfolder: 'outputs',
        outputCount: 4,
        allOutputs: [
          createOutput('parent.png', '1', 'outputs'),
          createOutput('child-1.png', '2', 'outputs'),
          createOutput('child-2.png', '3', 'outputs'),
          createOutput('child-3.png', '4', 'outputs')
        ]
      })
      const child = createOutputAsset('child-1', 'child-1.png', {
        promptId: 'prompt-1',
        nodeId: '2',
        subfolder: 'outputs'
      })

      expect(getTotalOutputCount([parent, child])).toBe(4)
    })

    it('falls back to outputCount when only unresolved stack count exists', () => {
      const { getTotalOutputCount } = useAssetSelection()
      const parent = createOutputAsset('parent', 'parent.png', {
        promptId: 'prompt-1',
        nodeId: '1',
        subfolder: 'outputs',
        outputCount: 4
      })

      expect(getTotalOutputCount([parent])).toBe(4)
    })

    it('counts non-output metadata assets as one each', () => {
      const { getTotalOutputCount } = useAssetSelection()
      const assetA: AssetItem = { id: 'a', name: 'a.png', tags: ['input'] }
      const assetB: AssetItem = { id: 'b', name: 'b.png', tags: ['input'] }

      expect(getTotalOutputCount([assetA, assetB])).toBe(2)
    })
  })
})
