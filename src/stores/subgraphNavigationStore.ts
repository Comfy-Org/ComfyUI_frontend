import QuickLRU from '@alloc/quick-lru'
import type { Subgraph } from '@comfyorg/litegraph'
import type { DragAndScaleState } from '@comfyorg/litegraph/dist/DragAndScale'
import { defineStore } from 'pinia'
import { computed, shallowReactive, shallowRef, watch } from 'vue'

import { app } from '@/scripts/app'
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
    const idStack = shallowReactive<string[]>([])

    /** LRU cache for viewport states. Key: subgraph ID or 'root' for root graph */
    const viewportCache = new QuickLRU<string, DragAndScaleState>({
      maxSize: 32
    })

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

    /**
     * Get the current viewport state.
     * @returns The current viewport state, or null if the canvas is not available.
     */
    const getCurrentViewport = (): DragAndScaleState | null => {
      const canvas = canvasStore.getCanvas()
      if (!canvas) return null

      return {
        scale: canvas.ds.state.scale,
        offset: [...canvas.ds.state.offset]
      }
    }

    /**
     * Save the current viewport state.
     * @param graphId The graph ID to save for. Use 'root' for root graph, or omit to use current context.
     */
    const saveViewport = (graphId: string) => {
      const viewport = getCurrentViewport()
      if (!viewport) return

      viewportCache.set(graphId, viewport)
    }

    /**
     * Restore viewport state for a graph.
     * @param graphId The graph ID to restore. Use 'root' for root graph, or omit to use current context.
     */
    const restoreViewport = (graphId: string) => {
      const viewport = viewportCache.get(graphId)
      if (!viewport) return

      const canvas = app.canvas
      if (!canvas) return

      canvas.ds.scale = viewport.scale
      canvas.ds.offset[0] = viewport.offset[0]
      canvas.ds.offset[1] = viewport.offset[1]
      canvas.setDirty(true, true)
    }

    // Reset on workflow change
    watch(
      () => workflowStore.activeWorkflow,
      () => {
        idStack.length = 0
      }
    )

    // Update navigation stack when opened subgraph changes
    watch(
      () => workflowStore.activeSubgraph,
      (subgraph, prevSubgraph) => {
        // Save viewport state for the graph we're leaving
        if (prevSubgraph) {
          // Leaving a subgraph
          saveViewport(prevSubgraph.id)
        } else if (!prevSubgraph && subgraph) {
          // Leaving root graph to enter a subgraph
          saveViewport('root')
        }

        // Navigated back to the root graph
        if (!subgraph) {
          idStack.length = 0
          restoreViewport('root')
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

        // Always try to restore viewport for the target subgraph
        restoreViewport(subgraph.id)
      }
    )

    return {
      activeSubgraph,
      navigationStack,
      restoreState,
      exportState,
      saveViewport,
      restoreViewport,
      viewportCache
    }
  }
)
