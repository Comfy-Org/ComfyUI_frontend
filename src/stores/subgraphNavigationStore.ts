import type { Subgraph } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'
import { computed, shallowReactive, shallowRef, watch } from 'vue'

import { isNonNullish } from '@/utils/typeGuardUtil'

import { useCanvasStore } from './graphStore'
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
    const canvasStore = useCanvasStore()

    /** The currently opened subgraph. */
    const activeSubgraph = shallowRef<Subgraph>()

    /** The stack of subgraph IDs from the root graph to the currently opened subgraph. */
    const subgraphIdStack = shallowReactive<string[]>([])

    /**
     * A stack representing subgraph navigation history from the root graph to
     * the current opened subgraph.
     */
    const navigationStack = computed(() =>
      subgraphIdStack
        .map((id) => canvasStore.getCanvas().graph?.subgraphs.get(id))
        .filter(isNonNullish)
    )

    // Reset on workflow change
    watch(
      () => workflowStore.activeWorkflow,
      () => (subgraphIdStack.length = 0)
    )

    // Update navigation stack when opened subgraph changes
    watch(
      () => workflowStore.activeSubgraph,
      (subgraph) => {
        // Navigated back to the root graph
        if (!subgraph) {
          subgraphIdStack.length = 0
          return
        }

        const index = subgraphIdStack.lastIndexOf(subgraph.id)
        const lastIndex = subgraphIdStack.length - 1

        if (index === -1) {
          // Opened a new subgraph
          subgraphIdStack.push(subgraph.id)
        } else if (index !== lastIndex) {
          // Navigated to a different subgraph
          subgraphIdStack.splice(index + 1, lastIndex - index)
        }
      }
    )

    return {
      activeSubgraph,
      navigationStack
    }
  }
)
