import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import {
  computeActiveGraphIds,
  computeAncestorExecutionIds,
  createVerificationAbortController
} from '@/platform/missing/missingCandidateHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'

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

  /** `nodeId::widgetName` keys, so per-widget render lookups stay O(1). */
  const missingMediaWidgetKeys = computed<Set<string>>(() => {
    const keys = new Set<string>()
    for (const candidate of missingMediaCandidates.value ?? []) {
      keys.add(`${String(candidate.nodeId)}::${candidate.widgetName}`)
    }
    return keys
  })

  const missingMediaAncestorExecutionIds = computed(() =>
    computeAncestorExecutionIds(missingMediaNodeIds.value)
  )

  const activeMissingMediaGraphIds = computed(() =>
    computeActiveGraphIds(
      app.rootGraph,
      canvasStore.currentGraph,
      missingMediaAncestorExecutionIds.value
    )
  )

  const verificationAbortController = createVerificationAbortController()

  function setMissingMedia(media: MissingMediaCandidate[]) {
    missingMediaCandidates.value = media.length ? media : null
  }

  function hasMissingMediaOnNode(nodeLocatorId: NodeLocatorId): boolean {
    const executionId =
      useWorkflowStore().nodeLocatorIdToNodeExecutionId(nodeLocatorId)
    return executionId ? missingMediaNodeIds.value.has(executionId) : false
  }

  function isContainerWithMissingMedia(node: LGraphNode): boolean {
    return activeMissingMediaGraphIds.value.has(String(node.id))
  }

  function isWidgetMissingMedia(
    nodeId: NodeExecutionId,
    widgetName: string
  ): boolean {
    return missingMediaWidgetKeys.value.has(`${String(nodeId)}::${widgetName}`)
  }

  function removeMissingMediaByWidget(nodeId: string, widgetName: string) {
    if (!missingMediaCandidates.value) return
    missingMediaCandidates.value = missingMediaCandidates.value.filter(
      (m) => !(String(m.nodeId) === nodeId && m.widgetName === widgetName)
    )
    if (!missingMediaCandidates.value.length)
      missingMediaCandidates.value = null
  }

  function removeMissingMediaByNodeId(nodeId: string) {
    if (!missingMediaCandidates.value) return
    missingMediaCandidates.value = missingMediaCandidates.value.filter(
      (m) => String(m.nodeId) !== nodeId
    )
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
    const remaining: MissingMediaCandidate[] = []
    for (const m of missingMediaCandidates.value) {
      // Preserve candidates without a nodeId; they cannot belong to any
      // subgraph scope. The type marks nodeId as required, but defensive
      // handling matches the rest of the missing-media code.
      if (m.nodeId == null) {
        remaining.push(m)
        continue
      }
      if (!String(m.nodeId).startsWith(prefix)) {
        remaining.push(m)
      }
    }
    if (remaining.length === missingMediaCandidates.value.length) return
    missingMediaCandidates.value = remaining.length ? remaining : null
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
    verificationAbortController.abort()
    missingMediaCandidates.value = null
  }

  return {
    missingMediaCandidates,
    hasMissingMedia,
    missingMediaCount,
    missingMediaNodeIds,
    missingMediaAncestorExecutionIds,
    activeMissingMediaGraphIds,

    hasMissingMediaOnNode,
    setMissingMedia,
    addMissingMedia,
    removeMissingMediaByWidget,
    removeMissingMediaByNodeId,
    removeMissingMediaByPrefix,
    clearMissingMedia,
    createVerificationAbortController: verificationAbortController.create,

    isContainerWithMissingMedia,
    isWidgetMissingMedia
  }
})
