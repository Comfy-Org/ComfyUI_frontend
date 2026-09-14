import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { NodeLocatorId } from '@/types/nodeIdentification'

/**
 * When the agent created each node, keyed the same way execution progress is,
 * so a node in a subgraph stays distinct from the node of that id at the root.
 *
 * A mark is provenance and holds for as long as the session does: the minimap
 * draws agent-authored nodes differently from the ones a human placed. The
 * stamp itself only feeds the entry animation. Nothing here survives a reload,
 * since provenance is not part of the serialised workflow.
 */
export const useAgentGeneratedNodesStore = defineStore(
  'agentGeneratedNodes',
  () => {
    const generatedAt = ref(new Map<NodeLocatorId, number>())

    /** Most recent stamp, or 0 when the agent has generated nothing. */
    const latestMarkAt = ref(0)

    function markGenerated(
      locatorId: NodeLocatorId,
      at: number = Date.now()
    ): void {
      generatedAt.value.set(locatorId, at)
      latestMarkAt.value = Math.max(latestMarkAt.value, at)
    }

    function generatedAtFor(locatorId: NodeLocatorId): number | undefined {
      return generatedAt.value.get(locatorId)
    }

    function clear(): void {
      generatedAt.value.clear()
      latestMarkAt.value = 0
    }

    return {
      latestMarkAt,
      markGenerated,
      generatedAtFor,
      clear
    }
  }
)
