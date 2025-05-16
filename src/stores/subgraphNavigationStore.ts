import type { Subgraph } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'
import { computed, shallowReactive, shallowRef, watch } from 'vue'

import { app } from '@/scripts/app'
import { isNonNullish } from '@/utils/typeGuardUtil'

import { useWorkflowStore } from './workflowStore'

/**
 * Stores the current subgraph navigation state; a stack representing subgraph
 * navigation history from the root graph to the subgraph that is currently
 * open.
 */
export const useSubgraphNavigationStore = defineStore(
  'subgraphNavigation',
  () => {
    const workflowStore = useWorkflowStore()

    /** The currently opened subgraph. */
    const activeSubgraph = shallowRef<Subgraph>()

    /** The stack of subgraph IDs from the root graph to the currently opened subgraph. */
    const idStack = shallowReactive<string[]>([])

    /**
     * A stack representing subgraph navigation history from the root graph to
     * the current opened subgraph.
     */
    const navigationStack = computed(() =>
      idStack.map((id) => app.graph.subgraphs.get(id)).filter(isNonNullish)
    )

    /**
     * Restore the navigation stack from a list of subgraph IDs.
     * @param subgraphIds The list of subgraph IDs to restore the navigation stack from.
     * @see exportState
     */
    const restoreState = (subgraphIds: string[]) => {
      idStack.length = 0
      for (const id of subgraphIds) idStack.push(id)
    }

    /**
     * Export the navigation stack as a list of subgraph IDs.
     * @returns The list of subgraph IDs, ending with the currently active subgraph.
     * @see restoreState
     */
    const exportState = () => [...idStack]

    // Reset on workflow change
    watch(
      () => workflowStore.activeWorkflow,
      () => (idStack.length = 0)
    )

    // Update navigation stack when opened subgraph changes
    watch(
      () => workflowStore.activeSubgraph,
      (subgraph) => {
        // Navigated back to the root graph
        if (!subgraph) {
          idStack.length = 0
          return
        }

        const index = idStack.lastIndexOf(subgraph.id)
        const lastIndex = idStack.length - 1

        if (index === -1) {
          // Opened a new subgraph
          idStack.push(subgraph.id)
        } else if (index !== lastIndex) {
          // Navigated to a different subgraph
          idStack.splice(index + 1, lastIndex - index)
        }
      }
    )

    return {
      activeSubgraph,
      navigationStack,
      restoreState,
      exportState
    }
  }
)
