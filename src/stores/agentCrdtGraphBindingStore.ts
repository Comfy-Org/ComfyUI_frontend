import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

import type { RootGraphId } from '@/types/graphScopeId'

/**
 * Which root graphs are currently bound to the in-app agent's collaborative
 * (CRDT) doc, i.e. a graph the agent may independently mint node ids into —
 * as opposed to a plain local-only graph. Written by the agent panel as its
 * bound workflow activates/deactivates; read by `LGraph.add()` to choose a
 * node-id mint mode that cannot collide with the agent's own mints (PM-1251).
 */
export const useAgentCrdtGraphBindingStore = defineStore(
  'agentCrdtGraphBinding',
  () => {
    const boundRootGraphIds = shallowReactive(new Set<RootGraphId>())

    function setBound(rootGraphId: RootGraphId, bound: boolean): void {
      if (bound) boundRootGraphIds.add(rootGraphId)
      else boundRootGraphIds.delete(rootGraphId)
    }

    function isBound(rootGraphId: RootGraphId): boolean {
      return boundRootGraphIds.has(rootGraphId)
    }

    return { setBound, isBound }
  }
)
