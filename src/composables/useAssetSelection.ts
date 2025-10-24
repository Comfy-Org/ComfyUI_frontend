import { useKeyModifier } from '@vueuse/core'
import { computed } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetSelectionStore } from '@/stores/assetSelectionStore'

export function useAssetSelection() {
  const selectionStore = useAssetSelectionStore()

  // Key modifiers
  const shiftKey = useKeyModifier('Shift')
  const ctrlKey = useKeyModifier('Control')
  const metaKey = useKeyModifier('Meta')
  const cmdOrCtrlKey = computed(() => ctrlKey.value || metaKey.value)

  /**
   * Handle asset click with modifier keys for selection
   * @param asset The clicked asset
   * @param index The index of the clicked asset in the current list
   * @param allAssets All assets in the current view for range selection
   */
  function handleAssetClick(
    asset: AssetItem,
    index: number,
    allAssets: AssetItem[]
  ) {
    const assetId = asset.id

    // Shift + Click: Range selection
    if (shiftKey.value && selectionStore.lastSelectedIndex >= 0) {
      const start = Math.min(selectionStore.lastSelectedIndex, index)
      const end = Math.max(selectionStore.lastSelectedIndex, index)

      // Get IDs of assets in range
      const rangeIds = allAssets.slice(start, end + 1).map((a) => a.id)

      // Add range to selection (keep existing selections)
      rangeIds.forEach((id) => selectionStore.addToSelection(id))

      // Don't update lastSelectedIndex for shift selection
      return
    }

    // Ctrl/Cmd + Click: Toggle individual selection
    if (cmdOrCtrlKey.value) {
      selectionStore.toggleSelection(assetId)
      selectionStore.setLastSelectedIndex(index)
      return
    }

    // Normal Click: Single selection
    selectionStore.clearSelection()
    selectionStore.addToSelection(assetId)
    selectionStore.setLastSelectedIndex(index)
  }

  /**
   * Select all assets in the current view
   */
  function selectAll(allAssets: AssetItem[]) {
    const allIds = allAssets.map((a) => a.id)
    selectionStore.setSelection(allIds)
    if (allAssets.length > 0) {
      selectionStore.setLastSelectedIndex(allAssets.length - 1)
    }
  }

  /**
   * Get the actual asset objects for selected IDs
   */
  function getSelectedAssets(allAssets: AssetItem[]): AssetItem[] {
    return allAssets.filter((asset) => selectionStore.isSelected(asset.id))
  }

  return {
    // Selection state
    selectedIds: computed(() => selectionStore.selectedAssetIds),
    selectedCount: computed(() => selectionStore.selectedCount),
    hasSelection: computed(() => selectionStore.hasSelection),
    isSelected: (assetId: string) => selectionStore.isSelected(assetId),

    // Selection actions
    handleAssetClick,
    selectAll,
    clearSelection: () => selectionStore.clearSelection(),
    getSelectedAssets,

    // Key states (for UI feedback)
    shiftKey,
    cmdOrCtrlKey
  }
}
