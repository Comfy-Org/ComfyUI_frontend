import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getActiveGraphNodeIds } from '@/utils/graphTraversalUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

/**
 * Missing media error state.
 * Separated from executionErrorStore to keep domain boundaries clean.
 * The executionErrorStore composes from this store for aggregate error flags.
 */
export const useMissingMediaStore = defineStore('missingMedia', () => {
  const canvasStore = useCanvasStore()

  const missingMediaCandidates = ref<MissingMediaCandidate[] | null>(null)

  const hasMissingMedia = computed(() => !!missingMediaCandidates.value?.length)

  const missingMediaCount = computed(
    () => missingMediaCandidates.value?.length ?? 0
  )

  const missingMediaNodeIds = computed(
    () =>
      new Set(missingMediaCandidates.value?.map((m) => String(m.nodeId)) ?? [])
  )

  /**
   * Set of all execution ID prefixes derived from missing media node IDs,
   * including the missing media nodes themselves.
   */
  const missingMediaAncestorExecutionIds = computed<Set<NodeExecutionId>>(
    () => {
      const ids = new Set<NodeExecutionId>()
      for (const nodeId of missingMediaNodeIds.value) {
        for (const id of getAncestorExecutionIds(nodeId)) {
          ids.add(id)
        }
      }
      return ids
    }
  )

  const activeMissingMediaGraphIds = computed<Set<string>>(() => {
    if (!app.rootGraph) return new Set()
    return getActiveGraphNodeIds(
      app.rootGraph,
      canvasStore.currentGraph ?? app.rootGraph,
      missingMediaAncestorExecutionIds.value
    )
  })

  // Interaction state — persists across component re-mounts
  const expandState = ref<Record<string, boolean>>({})
  const uploadState = ref<
    Record<string, { fileName: string; status: 'uploading' | 'uploaded' }>
  >({})
  /** Pending selection: value to apply on confirm. */
  const pendingSelection = ref<Record<string, string>>({})

  let _verificationAbortController: AbortController | null = null

  function createVerificationAbortController(): AbortController {
    _verificationAbortController?.abort()
    _verificationAbortController = new AbortController()
    return _verificationAbortController
  }

  function setMissingMedia(media: MissingMediaCandidate[]) {
    missingMediaCandidates.value = media.length ? media : null
  }

  function hasMissingMediaOnNode(nodeLocatorId: string): boolean {
    return missingMediaNodeIds.value.has(nodeLocatorId)
  }

  function isContainerWithMissingMedia(node: LGraphNode): boolean {
    return activeMissingMediaGraphIds.value.has(String(node.id))
  }

  function clearInteractionStateForName(name: string) {
    delete expandState.value[name]
    delete uploadState.value[name]
    delete pendingSelection.value[name]
  }

  function removeMissingMediaByName(name: string) {
    if (!missingMediaCandidates.value) return
    missingMediaCandidates.value = missingMediaCandidates.value.filter(
      (m) => m.name !== name
    )
    clearInteractionStateForName(name)
    if (!missingMediaCandidates.value.length)
      missingMediaCandidates.value = null
  }

  function removeMissingMediaByWidget(nodeId: string, widgetName: string) {
    if (!missingMediaCandidates.value) return
    const removedNames = new Set(
      missingMediaCandidates.value
        .filter(
          (m) => String(m.nodeId) === nodeId && m.widgetName === widgetName
        )
        .map((m) => m.name)
    )
    missingMediaCandidates.value = missingMediaCandidates.value.filter(
      (m) => !(String(m.nodeId) === nodeId && m.widgetName === widgetName)
    )
    for (const name of removedNames) {
      if (!missingMediaCandidates.value.some((m) => m.name === name)) {
        clearInteractionStateForName(name)
      }
    }
    if (!missingMediaCandidates.value.length)
      missingMediaCandidates.value = null
  }

  function removeMissingMediaByNodeId(nodeId: string) {
    if (!missingMediaCandidates.value) return
    const removedNames = new Set(
      missingMediaCandidates.value
        .filter((m) => String(m.nodeId) === nodeId)
        .map((m) => m.name)
    )
    missingMediaCandidates.value = missingMediaCandidates.value.filter(
      (m) => String(m.nodeId) !== nodeId
    )
    for (const name of removedNames) {
      if (!missingMediaCandidates.value.some((m) => m.name === name)) {
        clearInteractionStateForName(name)
      }
    }
    if (!missingMediaCandidates.value.length)
      missingMediaCandidates.value = null
  }

  /**
   * Remove all candidates whose nodeId starts with `prefix`.
   *
   * Intended for clearing all interior errors when a subgraph container is
   * removed. Callers are expected to pass `${execId}:` (with trailing
   * colon) so that sibling IDs sharing a numeric prefix (e.g. `"705"` vs
   * `"70"`) are not matched.
   */
  function removeMissingMediaByPrefix(prefix: string) {
    if (!missingMediaCandidates.value) return
    const removedNames = new Set<string>()
    const remaining: MissingMediaCandidate[] = []
    for (const m of missingMediaCandidates.value) {
      // Preserve candidates without a nodeId; they cannot belong to any
      // subgraph scope. The type marks nodeId as required, but defensive
      // handling matches the rest of the missing-media code.
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
    missingMediaCandidates.value = remaining.length ? remaining : null
    for (const name of removedNames) {
      if (!remaining.some((m) => m.name === name)) {
        clearInteractionStateForName(name)
      }
    }
  }

  function addMissingMedia(media: MissingMediaCandidate[]) {
    if (!media.length) return
    const existing = missingMediaCandidates.value ?? []
    const existingKeys = new Set(
      existing.map((m) => `${String(m.nodeId)}::${m.widgetName}::${m.name}`)
    )
    const newMedia = media.filter(
      (m) =>
        !existingKeys.has(`${String(m.nodeId)}::${m.widgetName}::${m.name}`)
    )
    if (!newMedia.length) return
    missingMediaCandidates.value = [...existing, ...newMedia]
  }

  function clearMissingMedia() {
    _verificationAbortController?.abort()
    _verificationAbortController = null
    missingMediaCandidates.value = null
    expandState.value = {}
    uploadState.value = {}
    pendingSelection.value = {}
  }

  return {
    missingMediaCandidates,
    hasMissingMedia,
    missingMediaCount,
    missingMediaNodeIds,
    missingMediaAncestorExecutionIds,
    activeMissingMediaGraphIds,

    setMissingMedia,
    addMissingMedia,
    removeMissingMediaByName,
    removeMissingMediaByWidget,
    removeMissingMediaByNodeId,
    removeMissingMediaByPrefix,
    clearMissingMedia,
    createVerificationAbortController,

    hasMissingMediaOnNode,
    isContainerWithMissingMedia,

    expandState,
    uploadState,
    pendingSelection
  }
})
