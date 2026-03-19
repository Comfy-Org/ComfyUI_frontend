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

  const missingMediaNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!missingMediaCandidates.value) return ids
    for (const m of missingMediaCandidates.value) {
      ids.add(String(m.nodeId))
    }
    return ids
  })

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

  function clearMissingMedia() {
    _verificationAbortController?.abort()
    _verificationAbortController = null
    missingMediaCandidates.value = null
  }

  return {
    missingMediaCandidates,
    hasMissingMedia,
    missingMediaCount,
    missingMediaNodeIds,
    missingMediaAncestorExecutionIds,
    activeMissingMediaGraphIds,

    setMissingMedia,
    clearMissingMedia,
    createVerificationAbortController,

    hasMissingMediaOnNode,
    isContainerWithMissingMedia
  }
})
