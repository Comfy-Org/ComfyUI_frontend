import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AssetId, AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetOutputCount,
  getTotalAssetOutputCount
} from '@/platform/assets/utils/outputAssetUtil'
import type { SelectionModifiers } from '@/platform/assets/utils/selectionModifiers'

export type AssetSource = 'output' | 'input'

export const useAssetSelectionStore = defineStore('assetSelection', () => {
  const selectedAssetIds = ref<Set<AssetId>>(new Set())
  const lastSelectedIndex = ref<number>(-1)
  const lastSelectedAssetId = ref<AssetId | null>(null)
  const activeSource = ref<AssetSource>('output')

  const selectedCount = computed(() => selectedAssetIds.value.size)
  const hasSelection = computed(() => selectedAssetIds.value.size > 0)
  const selectedIdsArray = computed(() => Array.from(selectedAssetIds.value))

  function addToSelection(assetId: AssetId) {
    selectedAssetIds.value.add(assetId)
  }

  function removeFromSelection(assetId: AssetId) {
    selectedAssetIds.value.delete(assetId)
  }

  function setSelection(assetIds: AssetId[]) {
    selectedAssetIds.value = new Set(assetIds)
  }

  function clearSelection() {
    selectedAssetIds.value.clear()
    lastSelectedIndex.value = -1
    lastSelectedAssetId.value = null
  }

  function toggleSelection(assetId: AssetId) {
    if (isSelected(assetId)) {
      removeFromSelection(assetId)
    } else {
      addToSelection(assetId)
    }
  }

  function isSelected(assetId: AssetId): boolean {
    return selectedAssetIds.value.has(assetId)
  }

  function setLastSelectedIndex(index: number) {
    lastSelectedIndex.value = index
  }

  function setLastSelectedAssetId(assetId: AssetId | null) {
    lastSelectedAssetId.value = assetId
  }

  function setAnchor(index: number, assetId: AssetId | null) {
    setLastSelectedIndex(index)
    setLastSelectedAssetId(assetId)
  }

  function setSource(source: AssetSource) {
    activeSource.value = source
  }

  function syncAnchorFromAssets(assets: AssetItem[]) {
    const anchorId = lastSelectedAssetId.value
    const anchorIndex = anchorId
      ? assets.findIndex((asset) => asset.id === anchorId)
      : -1

    if (anchorIndex !== -1) {
      setLastSelectedIndex(anchorIndex)
      return
    }

    setAnchor(-1, null)
  }

  function toggleAssetSelection(
    asset: AssetItem,
    index: number,
    allAssets: AssetItem[]
  ) {
    if (!asset?.id || index < 0 || index >= allAssets.length) {
      console.warn('Invalid asset selection parameters')
      return
    }

    toggleSelection(asset.id)
    setAnchor(index, asset.id)
  }

  function handleAssetClick(
    asset: AssetItem,
    index: number,
    allAssets: AssetItem[],
    { shift, cmdOrCtrl }: SelectionModifiers
  ) {
    if (!asset?.id || index < 0 || index >= allAssets.length) {
      console.warn('Invalid asset selection parameters')
      return
    }

    const assetId = asset.id

    if (shift && lastSelectedIndex.value >= 0) {
      const start = Math.min(lastSelectedIndex.value, index)
      const end = Math.max(lastSelectedIndex.value, index)
      setSelection(allAssets.slice(start, end + 1).map((a) => a.id))
      return
    }

    if (cmdOrCtrl) {
      toggleAssetSelection(asset, index, allAssets)
      return
    }

    if (isSelected(assetId) && selectedCount.value === 1) {
      return
    }

    clearSelection()
    addToSelection(assetId)
    setAnchor(index, assetId)
  }

  function selectAll(allAssets: AssetItem[]) {
    setSelection(allAssets.map((a) => a.id))
    if (allAssets.length > 0) {
      const lastIndex = allAssets.length - 1
      setAnchor(lastIndex, allAssets[lastIndex].id)
    }
  }

  function setSelectedIds(ids: AssetId[], allAssets: AssetItem[]) {
    setSelection(ids)
    const selected = new Set(ids)
    const anchorIndex = allAssets.findLastIndex((asset) =>
      selected.has(asset.id)
    )
    setAnchor(anchorIndex, anchorIndex >= 0 ? allAssets[anchorIndex].id : null)
  }

  function getSelectedAssets(allAssets: AssetItem[]): AssetItem[] {
    return allAssets.filter((asset) => isSelected(asset.id))
  }

  function reconcileSelection(assets: AssetItem[]) {
    if (selectedAssetIds.value.size === 0) {
      return
    }

    if (assets.length === 0) {
      clearSelection()
      return
    }

    const visibleIds = new Set(assets.map((asset) => asset.id))
    const nextSelectedIds: AssetId[] = []

    for (const id of selectedAssetIds.value) {
      if (visibleIds.has(id)) {
        nextSelectedIds.push(id)
      }
    }

    if (nextSelectedIds.length === selectedAssetIds.value.size) {
      syncAnchorFromAssets(assets)
      return
    }

    if (nextSelectedIds.length === 0) {
      clearSelection()
      return
    }

    setSelection(nextSelectedIds)
    syncAnchorFromAssets(assets)
  }

  function focusAsset(assetId: AssetId, options: { source: AssetSource }) {
    setSource(options.source)
    setSelection([assetId])
    setAnchor(-1, assetId)
  }

  function getOutputCount(item: AssetItem): number {
    return getAssetOutputCount(item)
  }

  function getTotalOutputCount(assets: AssetItem[]): number {
    return getTotalAssetOutputCount(assets)
  }

  return {
    selectedAssetIds: computed(() => selectedAssetIds.value),
    lastSelectedIndex: computed(() => lastSelectedIndex.value),
    lastSelectedAssetId: computed(() => lastSelectedAssetId.value),
    activeSource: computed(() => activeSource.value),

    selectedCount,
    hasSelection,
    selectedIdsArray,

    addToSelection,
    removeFromSelection,
    setSelection,
    clearSelection,
    toggleSelection,
    isSelected,
    setLastSelectedIndex,
    setLastSelectedAssetId,
    setAnchor,
    setSource,
    syncAnchorFromAssets,
    toggleAssetSelection,
    handleAssetClick,
    selectAll,
    setSelectedIds,
    getSelectedAssets,
    reconcileSelection,
    focusAsset,
    getOutputCount,
    getTotalOutputCount
  }
})
