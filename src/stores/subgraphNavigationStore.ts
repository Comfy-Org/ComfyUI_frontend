import QuickLRU from '@alloc/quick-lru'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import type { DragAndScaleState } from '@/lib/litegraph/src/DragAndScale'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import { findSubgraphPathById } from '@/utils/graphTraversalUtil'
import { isNonNullish } from '@/utils/typeGuardUtil'

export const VIEWPORT_CACHE_MAX_SIZE = 32

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
    const idStack = ref<string[]>([])

    /** LRU cache for viewport states. Key: `workflowPath:graphId` */
    const viewportCache = new QuickLRU<string, DragAndScaleState>({
      maxSize: VIEWPORT_CACHE_MAX_SIZE
    })

    /** Get the ID of the root graph for the currently active workflow. */
    const getCurrentRootGraphId = () => {
      const canvas = canvasStore.getCanvas()
      if (!canvas) return 'root'

      return canvas.graph?.rootGraph?.id ?? 'root'
    }

    /**
     * Set by saveCurrentViewport() (called from beforeLoadNewGraph) to
     * prevent onNavigated from re-saving a stale viewport during the
     * workflow switch transition. Uses setTimeout instead of rAF so the
     * flag resets even when the tab is backgrounded.
     */
    let isWorkflowSwitching = false
    // ── Helpers ──────────────────────────────────────────────────────

    /** Build a workflow-scoped cache key. */
    function buildCacheKey(
      graphId: string,
      workflowRef?: { path?: string } | null
    ): string {
      const wf = workflowRef ?? workflowStore.activeWorkflow
      const prefix = wf?.path ?? ''
      return `${prefix}:${graphId}`
    }

    /** ID of the graph currently shown on the canvas. */
    function getActiveGraphId(): string {
      const canvas = canvasStore.getCanvas()
      return canvas?.subgraph?.id ?? getCurrentRootGraphId()
    }

    // ── Navigation stack ─────────────────────────────────────────────

    /**
     * A stack representing subgraph navigation history from the root graph to
     * the current opened subgraph.
     */
    const navigationStack = computed(() =>
      idStack.value
        .map((id) => app.rootGraph.subgraphs.get(id))
        .filter(isNonNullish)
    )

    /**
     * Restore the navigation stack from a list of subgraph IDs.
     * @see exportState
     */
    const restoreState = (subgraphIds: string[]) => {
      idStack.value.length = 0
      for (const id of subgraphIds) idStack.value.push(id)
    }

    /**
     * Export the navigation stack as a list of subgraph IDs.
     * @see restoreState
     */
    const exportState = () => [...idStack.value]

    // ── Viewport save / restore ──────────────────────────────────────

    /** Get the current viewport state, or null if the canvas is not available. */
    const getCurrentViewport = (): DragAndScaleState | null => {
      const canvas = canvasStore.getCanvas()
      if (!canvas) return null
      return {
        scale: canvas.ds.state.scale,
        offset: [...canvas.ds.state.offset]
      }
    }

    /** Save the current viewport state for a graph. */
    function saveViewport(graphId: string, workflowRef?: object | null): void {
      const viewport = getCurrentViewport()
      if (!viewport) return
      viewportCache.set(buildCacheKey(graphId, workflowRef), viewport)
    }

    /** Apply a viewport state to the canvas. */
    function applyViewport(viewport: DragAndScaleState): void {
      const canvas = app.canvas
      if (!canvas) return
      canvas.ds.scale = viewport.scale
      canvas.ds.offset[0] = viewport.offset[0]
      canvas.ds.offset[1] = viewport.offset[1]
      canvas.setDirty(true, true)
    }

    function restoreViewport(graphId: string): void {
      const canvas = app.canvas
      if (!canvas) return

      const expectedKey = buildCacheKey(graphId)
      const viewport = viewportCache.get(expectedKey)
      if (viewport) {
        applyViewport(viewport)
        return
      }

      // Cache miss — fit to content after the canvas has the new graph.
      // rAF fires after layout + paint, when nodes are positioned.
      const expectedGraphId = graphId
      requestAnimationFrame(() => {
        if (getActiveGraphId() !== expectedGraphId) return
        useLitegraphService().fitView()
      })
    }

    // ── Navigation handler ───────────────────────────────────────────

    function onNavigated(
      subgraph: Subgraph | undefined,
      prevSubgraph: Subgraph | undefined
    ): void {
      // During a workflow switch, beforeLoadNewGraph already saved the
      // outgoing viewport — skip the save here to avoid caching stale
      // canvas state from the transition.
      if (!isWorkflowSwitching) {
        if (prevSubgraph) {
          saveViewport(prevSubgraph.id)
        } else if (!prevSubgraph && subgraph) {
          saveViewport(getCurrentRootGraphId())
        }
      }

      const isInRootGraph = !subgraph
      if (isInRootGraph) {
        idStack.value.length = 0
        restoreViewport(getCurrentRootGraphId())
        return
      }

      const path = findSubgraphPathById(subgraph.rootGraph, subgraph.id)
      const isInReachableSubgraph = !!path
      if (isInReachableSubgraph) {
        idStack.value = [...path]
      } else {
        idStack.value = [subgraph.id]
      }

      restoreViewport(subgraph.id)
    }

    // ── Watchers ─────────────────────────────────────────────────────

    // Sync flush ensures we capture the outgoing viewport before any other
    // watchers or DOM updates from the same state change mutate the canvas.
    watch(
      () => workflowStore.activeSubgraph,
      (newValue, oldValue) => {
        onNavigated(newValue, oldValue)
      },
      { flush: 'sync' }
    )


    /** Save the current viewport for the active graph/workflow. Called by
     *  workflowService.beforeLoadNewGraph() before the canvas is overwritten. */
    function saveCurrentViewport(): void {
      saveViewport(getActiveGraphId())
      isWorkflowSwitching = true
      setTimeout(() => {
        isWorkflowSwitching = false
      }, 0)
    }


    return {
      activeSubgraph,
      navigationStack,
      restoreState,
      exportState,
      saveViewport,
      restoreViewport,
      saveCurrentViewport,
      /** @internal Exposed for test assertions only. */
      viewportCache
    }
  }
)
