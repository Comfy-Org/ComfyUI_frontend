import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getActiveGraphNodeIds } from '@/utils/graphTraversalUtil'

/**
 * Missing model error state and interaction state.
 * Separated from executionErrorStore to keep domain boundaries clean.
 * The executionErrorStore composes from this store for aggregate error flags.
 */
export const useMissingModelStore = defineStore('missingModel', () => {
  const canvasStore = useCanvasStore()

  const missingModelCandidates = ref<MissingModelCandidate[] | null>(null)

  const hasMissingModels = computed(
    () => !!missingModelCandidates.value?.length
  )

  const missingModelCount = computed(
    () => missingModelCandidates.value?.length ?? 0
  )

  const missingModelNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!missingModelCandidates.value) return ids
    for (const m of missingModelCandidates.value) {
      if (m.nodeId != null) ids.add(String(m.nodeId))
    }
    return ids
  })

  const missingModelWidgetKeys = computed<Set<string>>(() => {
    const keys = new Set<string>()
    if (!missingModelCandidates.value) return keys
    for (const m of missingModelCandidates.value) {
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
    if (!app.rootGraph) return new Set()
    return getActiveGraphNodeIds(
      app.rootGraph,
      canvasStore.currentGraph ?? app.rootGraph,
      missingModelAncestorExecutionIds.value
    )
  })

  // Persists across component re-mounts so that download progress,
  // URL inputs, etc. survive tab switches within the right-side panel.
  const modelExpandState = ref<Record<string, boolean>>({})
  const selectedLibraryModel = ref<Record<string, string>>({})
  const importCategoryMismatch = ref<Record<string, string>>({})
  const importTaskIds = ref<Record<string, string>>({})
  const urlInputs = ref<Record<string, string>>({})
  const urlMetadata = ref<Record<string, AssetMetadata | null>>({})
  const urlFetching = ref<Record<string, boolean>>({})
  const urlErrors = ref<Record<string, string>>({})
  const urlImporting = ref<Record<string, boolean>>({})
  const folderPaths = ref<Record<string, string[]>>({})
  const fileSizes = ref<Record<string, number>>({})

  const _urlDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}

  let _verificationAbortController: AbortController | null = null

  onScopeDispose(cancelDebounceTimers)

  function createVerificationAbortController(): AbortController {
    _verificationAbortController?.abort()
    _verificationAbortController = new AbortController()
    return _verificationAbortController
  }

  function setMissingModels(models: MissingModelCandidate[]) {
    missingModelCandidates.value = models.length ? models : null
  }

  function removeMissingModelByNameOnNodes(
    modelName: string,
    nodeIds: Set<string>
  ) {
    if (!missingModelCandidates.value) return
    missingModelCandidates.value = missingModelCandidates.value.filter(
      (m) =>
        m.name !== modelName ||
        m.nodeId == null ||
        !nodeIds.has(String(m.nodeId))
    )
    if (!missingModelCandidates.value.length)
      missingModelCandidates.value = null
  }

  function removeMissingModelByWidget(nodeId: string, widgetName: string) {
    if (!missingModelCandidates.value) return
    missingModelCandidates.value = missingModelCandidates.value.filter(
      (m) => !(String(m.nodeId) === nodeId && m.widgetName === widgetName)
    )
    if (!missingModelCandidates.value.length)
      missingModelCandidates.value = null
  }

  function hasMissingModelOnNode(nodeLocatorId: string): boolean {
    return missingModelNodeIds.value.has(nodeLocatorId)
  }

  function isWidgetMissingModel(nodeId: string, widgetName: string): boolean {
    return missingModelWidgetKeys.value.has(`${nodeId}::${widgetName}`)
  }

  function isContainerWithMissingModel(node: LGraphNode): boolean {
    return activeMissingModelGraphIds.value.has(String(node.id))
  }

  function cancelDebounceTimers() {
    for (const key of Object.keys(_urlDebounceTimers)) {
      clearTimeout(_urlDebounceTimers[key])
      delete _urlDebounceTimers[key]
    }
  }

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

  function clearDebounceTimer(key: string) {
    if (_urlDebounceTimers[key]) {
      clearTimeout(_urlDebounceTimers[key])
      delete _urlDebounceTimers[key]
    }
  }

  function setFolderPaths(paths: Record<string, string[]>) {
    folderPaths.value = paths
  }

  function setFileSize(url: string, size: number) {
    fileSizes.value[url] = size
  }

  function clearMissingModels() {
    _verificationAbortController?.abort()
    _verificationAbortController = null
    missingModelCandidates.value = null
    cancelDebounceTimers()
    modelExpandState.value = {}
    selectedLibraryModel.value = {}
    importCategoryMismatch.value = {}
    importTaskIds.value = {}
    urlInputs.value = {}
    urlMetadata.value = {}
    urlFetching.value = {}
    urlErrors.value = {}
    urlImporting.value = {}
    folderPaths.value = {}
    fileSizes.value = {}
  }

  return {
    missingModelCandidates,
    hasMissingModels,
    missingModelCount,
    missingModelNodeIds,
    activeMissingModelGraphIds,
    missingModelAncestorExecutionIds,

    setMissingModels,
    removeMissingModelByNameOnNodes,
    removeMissingModelByWidget,
    clearMissingModels,
    createVerificationAbortController,

    hasMissingModelOnNode,
    isWidgetMissingModel,
    isContainerWithMissingModel,

    modelExpandState,
    selectedLibraryModel,
    importTaskIds,
    importCategoryMismatch,
    urlInputs,
    urlMetadata,
    urlFetching,
    urlErrors,
    urlImporting,
    folderPaths,
    fileSizes,

    setFolderPaths,
    setFileSize,

    setDebounceTimer,
    clearDebounceTimer
  }
})
