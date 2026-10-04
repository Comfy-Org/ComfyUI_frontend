import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AssetId } from '@/platform/assets/schemas/assetSchema'

export const useAssetSelectionStore = defineStore('assetSelection', () => {
  // State
  const selectedAssetIds = ref<Set<AssetId>>(new Set())
  const selectedAtById = ref<Map<AssetId, number>>(new Map())
  const lastSelectedIndex = ref<number>(-1)
  const lastSelectedAssetId = ref<AssetId | null>(null)

  // Getters
  const selectedCount = computed(() => selectedAssetIds.value.size)
  const hasSelection = computed(() => selectedAssetIds.value.size > 0)
  const selectedIdsArray = computed(() => Array.from(selectedAssetIds.value))

  function rememberJoined(assetId: AssetId, at: number) {
    if (selectedAtById.value.has(assetId)) return
    selectedAtById.value.set(assetId, at)
  }

  function forgetJoined(assetId: AssetId) {
    selectedAtById.value.delete(assetId)
  }

  // Actions
  function addToSelection(assetId: AssetId) {
    rememberJoined(assetId, Date.now())
    selectedAssetIds.value.add(assetId)
  }

  function removeFromSelection(assetId: AssetId) {
    selectedAssetIds.value.delete(assetId)
    forgetJoined(assetId)
  }

  function setSelection(assetIds: AssetId[]) {
    const next = new Set(assetIds)
    const now = Date.now()
    for (const id of selectedAssetIds.value) {
      if (!next.has(id)) forgetJoined(id)
    }
    for (const id of next) rememberJoined(id, now)
    selectedAssetIds.value = next
  }

  function clearSelection() {
    selectedAssetIds.value.clear()
    selectedAtById.value.clear()
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

  function getSelectedAt(assetId: AssetId): number | null {
    if (!selectedAssetIds.value.has(assetId)) return null
    return selectedAtById.value.get(assetId) ?? null
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
    getSelectedAt,
    setLastSelectedIndex,
    setLastSelectedAssetId
  }
})
