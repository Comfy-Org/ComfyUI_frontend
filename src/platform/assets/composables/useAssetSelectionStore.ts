import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAssetSelectionStore = defineStore('assetSelection', () => {
  // State
  const selectedAssetIds = ref<Set<string>>(new Set())
  const lastSelectedIndex = ref<number>(-1)

  // Getters
  const selectedCount = computed(() => selectedAssetIds.value.size)
  const hasSelection = computed(() => selectedAssetIds.value.size > 0)
  const selectedIdsArray = computed(() => Array.from(selectedAssetIds.value))

  // Actions
  function addToSelection(assetId: string) {
    selectedAssetIds.value.add(assetId)
  }

  function removeFromSelection(assetId: string) {
    selectedAssetIds.value.delete(assetId)
  }

  function setSelection(assetIds: string[]) {
    selectedAssetIds.value = new Set(assetIds)
  }

  function clearSelection() {
    selectedAssetIds.value.clear()
    lastSelectedIndex.value = -1
  }

  function toggleSelection(assetId: string) {
    if (isSelected(assetId)) {
      removeFromSelection(assetId)
    } else {
      addToSelection(assetId)
    }
  }

  function isSelected(assetId: string): boolean {
    return selectedAssetIds.value.has(assetId)
  }

  function setLastSelectedIndex(index: number) {
    lastSelectedIndex.value = index
  }

  return {
    // State
    selectedAssetIds: computed(() => selectedAssetIds.value),
    lastSelectedIndex: computed(() => lastSelectedIndex.value),

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
    setLastSelectedIndex
  }
})
