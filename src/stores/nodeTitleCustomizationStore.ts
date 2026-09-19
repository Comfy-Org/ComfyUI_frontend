import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

/**
 * Session-local record of which node ids were deliberately human-renamed, so
 * `prepareNode()` in `agent/crdt/graphMutations.ts` can keep a customized
 * title through an unrelated agent reconcile instead of resetting it from the
 * doc's frozen add-time value. See ADR-CRDT-TITLE-0035.
 *
 * Does not survive a reload and does not reach another collaborator's
 * client: the signal never enters the replicated document. It also does not
 * survive a root graph id regeneration (`LGraph.clear()`, which fires on
 * every undo/redo) — see the ADR's Consequences section.
 */
export const useNodeTitleCustomizationStore = defineStore(
  'nodeTitleCustomization',
  () => {
    const customizedByRoot = reactive(new Map<RootGraphId, Set<NodeId>>())

    function markCustomized(rootGraphId: RootGraphId, nodeId: NodeId): void {
      let ids = customizedByRoot.get(rootGraphId)
      if (!ids) {
        ids = new Set()
        customizedByRoot.set(rootGraphId, ids)
      }
      ids.add(nodeId)
    }

    function isCustomized(rootGraphId: RootGraphId, nodeId: NodeId): boolean {
      return customizedByRoot.get(rootGraphId)?.has(nodeId) ?? false
    }

    function clearNode(rootGraphId: RootGraphId, nodeId: NodeId): void {
      const ids = customizedByRoot.get(rootGraphId)
      if (!ids) return
      ids.delete(nodeId)
      if (ids.size === 0) customizedByRoot.delete(rootGraphId)
    }

    function clearGraph(rootGraphId: RootGraphId): void {
      customizedByRoot.delete(rootGraphId)
    }

    return { markCustomized, isCustomized, clearNode, clearGraph }
  }
)
