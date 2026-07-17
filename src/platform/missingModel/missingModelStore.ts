import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { t } from '@/i18n'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  computeActiveGraphIds,
  computeAncestorExecutionIds,
  createVerificationAbortController
} from '@/platform/missing/missingCandidateHelpers'
import type { NodeLocatorId } from '@/types/nodeIdentification'

/**
 * Missing model error state and interaction state.
 * Separated from executionErrorStore to keep domain boundaries clean.
 * The executionErrorStore composes from this store for aggregate error flags.
 */
export const useMissingModelStore = defineStore('missingModel', () => {
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()

  const missingModelCandidates = ref<MissingModelCandidate[] | null>(null)
  const isRefreshingMissingModels = ref(false)

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

  const missingModelAncestorExecutionIds = computed(() =>
    computeAncestorExecutionIds(missingModelNodeIds.value)
  )

  const activeMissingModelGraphIds = computed(() =>
    computeActiveGraphIds(
      app.rootGraph,
      canvasStore.currentGraph,
      missingModelAncestorExecutionIds.value
    )
  )

  // Persists across component re-mounts so that download progress
  // survives tab switches within the right-side panel.
  const modelExpandState = ref<Record<string, boolean>>({})
  const selectedLibraryModel = ref<Record<string, string>>({})
  const importTaskIds = ref<Record<string, string>>({})
  const folderPaths = ref<Record<string, string[]>>({})
  const fileSizes = ref<Record<string, number>>({})

  const verificationAbortController = createVerificationAbortController()

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

  function clearInteractionStateForName(name: string) {
    delete modelExpandState.value[name]
    delete selectedLibraryModel.value[name]
    delete importTaskIds.value[name]
  }

  function removeMissingModelsByNodeId(nodeId: string) {
    if (!missingModelCandidates.value) return
    const removedNames = new Set(
      missingModelCandidates.value
        .filter((m) => String(m.nodeId) === nodeId)
        .map((m) => m.name)
    )
    missingModelCandidates.value = missingModelCandidates.value.filter(
      (m) => String(m.nodeId) !== nodeId
    )
    for (const name of removedNames) {
      if (!missingModelCandidates.value.some((m) => m.name === name)) {
        clearInteractionStateForName(name)
      }
    }
    if (!missingModelCandidates.value.length)
      missingModelCandidates.value = null
  }

  /**
   * Remove all candidates whose nodeId starts with `prefix`.
   *
   * Intended for clearing all interior errors when a subgraph container is
   * removed. Callers are expected to pass `${execId}:` (with trailing
   * colon) so that sibling IDs sharing a numeric prefix (e.g. `"705"` vs
   * `"70"`) are not matched.
   */
  function removeMissingModelsByPrefix(prefix: string) {
    if (!missingModelCandidates.value) return
    const removedNames = new Set<string>()
    const remaining: MissingModelCandidate[] = []
    for (const m of missingModelCandidates.value) {
      // Preserve workflow-level candidates with no nodeId; they are not
      // tied to any subgraph scope and should never be matched by prefix.
      if (m.nodeId == null) {
        remaining.push(m)
        continue
      }
      if (String(m.nodeId).startsWith(prefix)) {
        removedNames.add(m.name)
      } else {
        remaining.push(m)
      }
    }
    if (removedNames.size === 0) return
    missingModelCandidates.value = remaining.length ? remaining : null
    for (const name of removedNames) {
      if (!remaining.some((m) => m.name === name)) {
        clearInteractionStateForName(name)
      }
    }
  }

  function removeMissingModelsBySourceScope(executionId: string) {
    if (!missingModelCandidates.value) return
    const prefix = `${executionId}:`
    const removedNames = new Set<string>()
    const remaining: MissingModelCandidate[] = []
    for (const candidate of missingModelCandidates.value) {
      const sourceExecutionId =
        candidate.sourceExecutionId == null
          ? undefined
          : String(candidate.sourceExecutionId)
      if (
        sourceExecutionId === executionId ||
        sourceExecutionId?.startsWith(prefix)
      ) {
        removedNames.add(candidate.name)
      } else {
        remaining.push(candidate)
      }
    }
    if (removedNames.size === 0) return
    missingModelCandidates.value = remaining.length ? remaining : null
    for (const name of removedNames) {
      if (!remaining.some((candidate) => candidate.name === name)) {
        clearInteractionStateForName(name)
      }
    }
  }

  function addMissingModels(models: MissingModelCandidate[]) {
    if (!models.length) return
    const existing = missingModelCandidates.value ?? []
    const existingKeys = new Set(
      existing.map((m) => `${String(m.nodeId)}::${m.widgetName}::${m.name}`)
    )
    const newModels = models.filter(
      (m) =>
        !existingKeys.has(`${String(m.nodeId)}::${m.widgetName}::${m.name}`)
    )
    if (!newModels.length) return
    missingModelCandidates.value = [...existing, ...newModels]
  }

  function hasMissingModelOnNode(nodeLocatorId: NodeLocatorId): boolean {
    const executionId =
      workflowStore.nodeLocatorIdToNodeExecutionId(nodeLocatorId)
    return executionId ? missingModelNodeIds.value.has(executionId) : false
  }

  function isWidgetMissingModel(nodeId: string, widgetName: string): boolean {
    return missingModelWidgetKeys.value.has(`${nodeId}::${widgetName}`)
  }

  function isContainerWithMissingModel(node: LGraphNode): boolean {
    return activeMissingModelGraphIds.value.has(String(node.id))
  }

  function setFolderPaths(paths: Record<string, string[]>) {
    folderPaths.value = paths
  }

  function setFileSize(url: string, size: number) {
    fileSizes.value[url] = size
  }

  function clearMissingModels() {
    verificationAbortController.abort()
    missingModelCandidates.value = null
    modelExpandState.value = {}
    selectedLibraryModel.value = {}
    importTaskIds.value = {}
    folderPaths.value = {}
    fileSizes.value = {}
  }

  function isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError'
  }

  async function refreshMissingModels() {
    if (isRefreshingMissingModels.value) return

    isRefreshingMissingModels.value = true
    try {
      await app.refreshMissingModels({ silent: true })
    } catch (error) {
      if (isAbortError(error)) return

      console.error('Failed to refresh missing models:', error)
      useToastStore().add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('rightSidePanel.missingModels.refreshFailed')
      })
    } finally {
      isRefreshingMissingModels.value = false
    }
  }

  return {
    missingModelCandidates,
    isRefreshingMissingModels,
    hasMissingModels,
    missingModelCount,
    missingModelNodeIds,
    activeMissingModelGraphIds,
    missingModelAncestorExecutionIds,

    setMissingModels,
    addMissingModels,
    removeMissingModelByNameOnNodes,
    removeMissingModelByWidget,
    removeMissingModelsByNodeId,
    removeMissingModelsByPrefix,
    removeMissingModelsBySourceScope,
    clearMissingModels,
    refreshMissingModels,
    createVerificationAbortController: verificationAbortController.create,

    hasMissingModelOnNode,
    isWidgetMissingModel,
    isContainerWithMissingModel,

    modelExpandState,
    selectedLibraryModel,
    importTaskIds,
    folderPaths,
    fileSizes,

    setFolderPaths,
    setFileSize
  }
})
