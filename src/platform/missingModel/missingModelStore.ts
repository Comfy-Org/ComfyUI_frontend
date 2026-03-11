import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

/**
 * Missing model error state and interaction state.
 * Separated from executionErrorStore to keep domain boundaries clean.
 * The executionErrorStore composes from this store for aggregate error flags.
 */
export const useMissingModelStore = defineStore('missingModel', () => {
  const canvasStore = useCanvasStore()

  // ─── Error detection state ───────────────────────────────────────

  const missingModelsError = ref<MissingModelCandidate[] | null>(null)

  const hasMissingModels = computed(() => !!missingModelsError.value?.length)

  const missingModelCount = computed(
    () => missingModelsError.value?.length ?? 0
  )

  const missingModelNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!missingModelsError.value) return ids
    for (const m of missingModelsError.value) {
      if (m.nodeId != null) ids.add(String(m.nodeId))
    }
    return ids
  })

  const missingModelWidgetKeys = computed<Set<string>>(() => {
    const keys = new Set<string>()
    if (!missingModelsError.value) return keys
    for (const m of missingModelsError.value) {
      keys.add(`${String(m.nodeId)}::${m.widgetName}`)
    }
    return keys
  })

  /**
   * Set of all execution ID prefixes derived from missing model node IDs,
   * including the missing model nodes themselves.
   *
   * Example: missing model on node "65:70:63" → Set { "65", "65:70", "65:70:63" }
   */
  const missingModelAncestorExecutionIds = computed<Set<NodeExecutionId>>(
    () => {
      const ids = new Set<NodeExecutionId>()
      for (const nodeId of missingModelNodeIds.value) {
        for (const id of getAncestorExecutionIds(nodeId)) {
          ids.add(id)
        }
      }
      return ids
    }
  )

  const activeMissingModelGraphIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!app.rootGraph) return ids

    const activeGraph = canvasStore.currentGraph ?? app.rootGraph

    for (const executionId of missingModelAncestorExecutionIds.value) {
      const graphNode = getNodeByExecutionId(app.rootGraph, executionId)
      if (graphNode?.graph === activeGraph) {
        ids.add(String(graphNode.id))
      }
    }

    return ids
  })

  // ─── Interaction state ───────────────────────────────────────────
  // Persists across component re-mounts so that download progress,
  // URL inputs, etc. survive tab switches within the right-side panel.

  const modelExpandState = ref<Record<string, boolean>>({})
  const selectedLibraryModel = ref<Record<string, string>>({})
  const importCategoryMismatch = ref<Record<string, string>>({})

  // Preserved across clearInteractionState() — active downloads tracked
  // by assetDownloadStore must remain accessible when the user navigates
  // back to a previous workflow.
  const importTaskIds = ref<Record<string, string>>({})

  const urlInputs = ref<Record<string, string>>({})
  const urlMetadata = ref<Record<string, AssetMetadata | null>>({})
  const urlFetching = ref<Record<string, boolean>>({})
  const urlErrors = ref<Record<string, string>>({})
  const urlImporting = ref<Record<string, boolean>>({})

  // Debounce timer handles — not serializable, kept separately for cleanup.
  const _urlDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}

  // ─── Error detection actions ─────────────────────────────────────

  function setMissingModels(models: MissingModelCandidate[]) {
    missingModelsError.value = models.length ? models : null
  }

  /**
   * Remove missing model candidates that match a specific model name
   * on the given set of node IDs.
   * This avoids accidentally removing unrelated missing models on
   * the same nodes (e.g. node has both ckpt_name and vae_name missing).
   */
  function removeMissingModelByNameOnNodes(
    modelName: string,
    nodeIds: Set<string>
  ) {
    if (!missingModelsError.value) return
    missingModelsError.value = missingModelsError.value.filter(
      (m) =>
        m.name !== modelName ||
        m.nodeId == null ||
        !nodeIds.has(String(m.nodeId))
    )
    if (!missingModelsError.value.length) missingModelsError.value = null
  }

  function hasMissingModelOnNode(nodeLocatorId: string): boolean {
    return missingModelNodeIds.value.has(nodeLocatorId)
  }

  function isWidgetMissingModel(nodeId: string, widgetName: string): boolean {
    return missingModelWidgetKeys.value.has(`${nodeId}::${widgetName}`)
  }

  /** True if the node has a missing model inside it at any nesting depth.
   *  Uses the precomputed `activeMissingModelGraphIds` set for O(1) lookup
   *  instead of per-call graph traversal. */
  function isContainerWithMissingModel(node: LGraphNode): boolean {
    return activeMissingModelGraphIds.value.has(String(node.id))
  }

  // ─── Interaction state actions ───────────────────────────────────

  /** Cancel all pending debounce timers. */
  function cancelDebounceTimers() {
    for (const key of Object.keys(_urlDebounceTimers)) {
      clearTimeout(_urlDebounceTimers[key])
      delete _urlDebounceTimers[key]
    }
  }

  /** Set a debounce timer for the given key. Cancels any existing timer. */
  function setDebounceTimer(
    key: string,
    callback: () => void,
    delayMs: number
  ) {
    if (_urlDebounceTimers[key]) {
      clearTimeout(_urlDebounceTimers[key])
    }
    _urlDebounceTimers[key] = setTimeout(callback, delayMs)
  }

  /** Cancel the debounce timer for a specific key. */
  function clearDebounceTimer(key: string) {
    if (_urlDebounceTimers[key]) {
      clearTimeout(_urlDebounceTimers[key])
      delete _urlDebounceTimers[key]
    }
  }

  /**
   * Reset all interaction state (e.g. on workflow change).
   * `importTaskIds` is intentionally preserved so that in-progress
   * downloads remain trackable across workflow switches.
   */
  function clearInteractionState() {
    cancelDebounceTimers()
    modelExpandState.value = {}
    selectedLibraryModel.value = {}
    importCategoryMismatch.value = {}
    urlInputs.value = {}
    urlMetadata.value = {}
    urlFetching.value = {}
    urlErrors.value = {}
    urlImporting.value = {}
  }

  /** Clear all missing model state. Called by executionErrorStore.clearAllErrors(). */
  function clearMissingModels() {
    missingModelsError.value = null
    clearInteractionState()
  }

  return {
    // Error detection
    missingModelsError,
    hasMissingModels,
    missingModelCount,
    missingModelNodeIds,
    activeMissingModelGraphIds,

    setMissingModels,
    removeMissingModelByNameOnNodes,
    clearMissingModels,

    hasMissingModelOnNode,
    isWidgetMissingModel,
    isContainerWithMissingModel,

    // Interaction state
    modelExpandState,
    selectedLibraryModel,
    importTaskIds,
    importCategoryMismatch,
    urlInputs,
    urlMetadata,
    urlFetching,
    urlErrors,
    urlImporting,

    // Interaction actions
    setDebounceTimer,
    clearDebounceTimer,
    clearInteractionState
  }
})
