import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AssetId } from '@/platform/assets/schemas/assetSchema'

export const useAssetSelectionStore = defineStore('assetSelection', () => {
  // State
  const selectedAssetIds = ref<Set<AssetId>>(new Set())
  const lastSelectedIndex = ref<number>(-1)
  const lastSelectedAssetId = ref<AssetId | null>(null)

  // Getters
  const selectedCount = computed(() => selectedAssetIds.value.size)
  const hasSelection = computed(() => selectedAssetIds.value.size > 0)
  const selectedIdsArray = computed(() => Array.from(selectedAssetIds.value))

  // Actions
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

  return {
    // State
    selectedAssetIds: computed(() => selectedAssetIds.value),
    lastSelectedIndex: computed(() => lastSelectedIndex.value),
    lastSelectedAssetId: computed(() => lastSelectedAssetId.value),

    // Getters
    selectedCount,
    hasSelection,
    selectedIdsArray,

    // Actions
    addToSelection,
    removeFromSelection,
    setSelection,
    clearSelection,
    toggleSelection,
    isSelected,
    setLastSelectedIndex,
    setLastSelectedAssetId
  }
})
