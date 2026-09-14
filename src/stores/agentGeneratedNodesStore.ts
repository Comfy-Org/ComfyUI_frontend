import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { NodeLocatorId } from '@/types/nodeIdentification'

/**
 * When the agent created each node, keyed the same way execution progress is,
 * so a node in a subgraph stays distinct from the node of that id at the root.
 *
 * Recency is the whole point of the record: the minimap draws the entry
 * animation from these stamps, and callers drop marks once they are older than
 * whatever window they animate over. The store holds no opinion on that window.
 */
export const useAgentGeneratedNodesStore = defineStore(
  'agentGeneratedNodes',
  () => {
    const generatedAt = ref(new Map<NodeLocatorId, number>())

    const hasMarks = computed(() => generatedAt.value.size > 0)

    function markGenerated(
      locatorId: NodeLocatorId,
      at: number = Date.now()
    ): void {
      generatedAt.value.set(locatorId, at)
    }

    function generatedAtFor(locatorId: NodeLocatorId): number | undefined {
      return generatedAt.value.get(locatorId)
    }

    function forgetMarksBefore(cutoff: number): void {
      for (const [locatorId, at] of generatedAt.value) {
        if (at <= cutoff) generatedAt.value.delete(locatorId)
      }
    }

    function clear(): void {
      generatedAt.value.clear()
    }

    return {
      hasMarks,
      markGenerated,
      generatedAtFor,
      forgetMarksBefore,
      clear
    }
  }
)
