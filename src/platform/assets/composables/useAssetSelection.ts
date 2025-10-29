import { useKeyModifier } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'

export function useAssetSelection() {
  const selectionStore = useAssetSelectionStore()

  // Track whether the asset selection is active (e.g., when sidebar is open)
  const isActive = ref<boolean>(true)

  // Key modifiers - raw values
  const shiftKeyRaw = useKeyModifier('Shift')
  const ctrlKeyRaw = useKeyModifier('Control')
  const metaKeyRaw = useKeyModifier('Meta')

  // Only respond to key modifiers when active
  const shiftKey = computed(() => isActive.value && shiftKeyRaw.value)
  const ctrlKey = computed(() => isActive.value && ctrlKeyRaw.value)
  const metaKey = computed(() => isActive.value && metaKeyRaw.value)
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
    // Input validation
    if (!asset?.id || index < 0 || index >= allAssets.length) {
      console.warn('Invalid asset selection parameters')
      return
    }

    const assetId = asset.id

    // Shift + Click: Range selection
    if (shiftKey.value && selectionStore.lastSelectedIndex >= 0) {
      const start = Math.min(selectionStore.lastSelectedIndex, index)
      const end = Math.max(selectionStore.lastSelectedIndex, index)

      // Batch operation for better performance
      const rangeIds = allAssets.slice(start, end + 1).map((a) => a.id)
      const existingIds = Array.from(selectionStore.selectedAssetIds)
      const combinedIds = [...new Set([...existingIds, ...rangeIds])]

      // Single update instead of multiple forEach operations
      selectionStore.setSelection(combinedIds)

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

  /**
   * Activate key event listeners (when sidebar opens)
   */
  function activate() {
    isActive.value = true
  }

  /**
   * Deactivate key event listeners (when sidebar closes)
   */
  function deactivate() {
    isActive.value = false
    // Reset selection state to ensure clean state when deactivated
    selectionStore.reset()
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
    reset: () => selectionStore.reset(),

    // Lifecycle management
    activate,
    deactivate,

    // Key states (for UI feedback)
    shiftKey,
    cmdOrCtrlKey
  }
}
