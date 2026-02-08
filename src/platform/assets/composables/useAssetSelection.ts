import { useKeyModifier } from '@vueuse/core'
import { computed, ref } from 'vue'

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getOutputKey } from '@/platform/assets/utils/outputAssetUtil'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'

type PromptSelection = {
  expectedOutputCount: number
  outputKeys: Set<string>
}

function getPromptSelection(
  selectionsByPromptId: Map<string, PromptSelection>,
  promptId: string
): PromptSelection {
  const existingSelection = selectionsByPromptId.get(promptId)
  if (existingSelection) {
    return existingSelection
  }

  const selection: PromptSelection = {
    expectedOutputCount: 0,
    outputKeys: new Set<string>()
  }
  selectionsByPromptId.set(promptId, selection)
  return selection
}

function updateExpectedOutputCount(
  selection: PromptSelection,
  outputCount: OutputAssetMetadata['outputCount']
) {
  if (
    typeof outputCount === 'number' &&
    outputCount > selection.expectedOutputCount
  ) {
    selection.expectedOutputCount = outputCount
  }
}

function resolveOutputKeysForSelection(
  asset: AssetItem,
  metadata: OutputAssetMetadata
): string[] {
  const allOutputKeys = (metadata.allOutputs ?? [])
    .map((output) => getOutputKey(output))
    .filter((key): key is string => key !== null)

  if (allOutputKeys.length > 0) {
    return allOutputKeys
  }

  const assetOutputKey = getOutputKey({
    nodeId: metadata.nodeId,
    subfolder: metadata.subfolder,
    filename: asset.name
  })

  return [assetOutputKey ?? `asset:${asset.id}`]
}

function getPromptSelectionCount(selection: PromptSelection): number {
  return Math.max(selection.outputKeys.size, selection.expectedOutputCount)
}

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

  function setAnchor(index: number, assetId: string | null) {
    selectionStore.setLastSelectedIndex(index)
    selectionStore.setLastSelectedAssetId(assetId)
  }

  function syncAnchorFromAssets(assets: AssetItem[]) {
    const anchorId = selectionStore.lastSelectedAssetId
    const anchorIndex = anchorId
      ? assets.findIndex((asset) => asset.id === anchorId)
      : -1

    if (anchorIndex !== -1) {
      selectionStore.setLastSelectedIndex(anchorIndex)
      return
    }

    setAnchor(-1, null)
  }

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

      // Select only the range from anchor to clicked item
      const rangeIds = allAssets.slice(start, end + 1).map((a) => a.id)
      selectionStore.setSelection(rangeIds)

      // Don't update lastSelectedIndex for shift selection
      return
    }

    // Ctrl/Cmd + Click: Toggle individual selection
    if (cmdOrCtrlKey.value) {
      selectionStore.toggleSelection(assetId)
      setAnchor(index, assetId)
      return
    }

    // Normal Click: Single selection
    selectionStore.clearSelection()
    selectionStore.addToSelection(assetId)
    setAnchor(index, assetId)
  }

  /**
   * Select all assets in the current view
   */
  function selectAll(allAssets: AssetItem[]) {
    const allIds = allAssets.map((a) => a.id)
    selectionStore.setSelection(allIds)
    if (allAssets.length > 0) {
      const lastIndex = allAssets.length - 1
      setAnchor(lastIndex, allAssets[lastIndex].id)
    }
  }

  /**
   * Get the actual asset objects for selected IDs
   */
  function getSelectedAssets(allAssets: AssetItem[]): AssetItem[] {
    return allAssets.filter((asset) => selectionStore.isSelected(asset.id))
  }

  function reconcileSelection(assets: AssetItem[]) {
    if (selectionStore.selectedAssetIds.size === 0) {
      return
    }

    if (assets.length === 0) {
      selectionStore.clearSelection()
      return
    }

    const visibleIds = new Set(assets.map((asset) => asset.id))
    const nextSelectedIds: string[] = []

    for (const id of selectionStore.selectedAssetIds) {
      if (visibleIds.has(id)) {
        nextSelectedIds.push(id)
      }
    }

    if (nextSelectedIds.length === selectionStore.selectedAssetIds.size) {
      syncAnchorFromAssets(assets)
      return
    }

    if (nextSelectedIds.length === 0) {
      selectionStore.clearSelection()
      return
    }

    selectionStore.setSelection(nextSelectedIds)
    syncAnchorFromAssets(assets)
  }

  /**
   * Get the output count for a single asset
   * Same logic as in AssetsSidebarTab.vue
   */
  function getOutputCount(item: AssetItem): number {
    const count = item.user_metadata?.outputCount
    return typeof count === 'number' && count > 0 ? count : 1
  }

  /**
   * Get the total output count for given assets
   */
  function getTotalOutputCount(assets: AssetItem[]): number {
    const nonOutputAssetIds = new Set<string>()
    const promptSelectionsByPromptId = new Map<string, PromptSelection>()

    for (const asset of assets) {
      const outputMetadata = getOutputAssetMetadata(asset.user_metadata)
      const promptId = outputMetadata?.promptId

      if (!promptId) {
        nonOutputAssetIds.add(asset.id)
        continue
      }

      const promptSelection = getPromptSelection(
        promptSelectionsByPromptId,
        promptId
      )
      updateExpectedOutputCount(promptSelection, outputMetadata.outputCount)

      for (const outputKey of resolveOutputKeysForSelection(
        asset,
        outputMetadata
      )) {
        promptSelection.outputKeys.add(outputKey)
      }
    }

    let totalOutputCount = nonOutputAssetIds.size
    for (const selection of promptSelectionsByPromptId.values()) {
      totalOutputCount += getPromptSelectionCount(selection)
    }

    return totalOutputCount
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
    selectionStore.clearSelection()
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
    reconcileSelection,
    getOutputCount,
    getTotalOutputCount,
    // Lifecycle management
    activate,
    deactivate,

    // Key states (for UI feedback)
    shiftKey,
    cmdOrCtrlKey
  }
}
