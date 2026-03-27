import QuickLRU from '@alloc/quick-lru'
import { useRouteHash } from '@vueuse/router'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { DragAndScaleState } from '@/lib/litegraph/src/DragAndScale'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import { app } from '@/scripts/app'
import { findSubgraphPathById } from '@/utils/graphTraversalUtil'
import { isNonNullish, isSubgraph } from '@/utils/typeGuardUtil'

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
    const router = useRouter()
    const routeHash = useRouteHash()

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
      return canvas.graph?.rootGraph?.id ?? 'root'
    }

    /**
     * Per-workflow-instance counter to disambiguate unsaved workflows
     * that share the same path. Keyed by workflow object identity.
     */
    const workflowInstanceIds = new WeakMap<object, number>()
    let nextInstanceId = 0
    const getWorkflowInstanceId = (workflow: object): number => {
      let id = workflowInstanceIds.get(workflow)
      if (id === undefined) {
        id = nextInstanceId++
        workflowInstanceIds.set(workflow, id)
      }
      return id
    }

    /**
     * Set by saveCurrentViewport() (called from beforeLoadNewGraph) to
     * prevent onNavigated from re-saving a stale viewport during the
     * workflow switch transition.
     */
    let isWorkflowSwitching = false
    // ── Helpers ──────────────────────────────────────────────────────

    /** Build a workflow-scoped cache key unique per workflow instance. */
    const cacheKey = (graphId: string, workflowRef?: object | null): string => {
      const wf = workflowRef ?? workflowStore.activeWorkflow
      const prefix = wf
        ? `${(wf as { path?: string }).path ?? ''}#${getWorkflowInstanceId(wf)}`
        : ''
      return `${prefix}:${graphId}`
    }

    /** ID of the graph currently shown on the canvas. */
    const getActiveGraphId = (): string => {
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
    const saveViewport = (graphId: string, workflowRef?: object | null) => {
      const viewport = getCurrentViewport()
      if (!viewport) return
      viewportCache.set(cacheKey(graphId, workflowRef), viewport)
    }

    /** Apply a viewport state to the canvas. */
    const applyViewport = (viewport: DragAndScaleState) => {
      const canvas = app.canvas
      if (!canvas) return
      canvas.ds.scale = viewport.scale
      canvas.ds.offset[0] = viewport.offset[0]
      canvas.ds.offset[1] = viewport.offset[1]
      canvas.setDirty(true, true)
    }

    const restoreViewport = (graphId: string) => {
      const canvas = app.canvas
      if (!canvas) return

      const expectedKey = cacheKey(graphId)
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

    const onNavigated = (
      subgraph: Subgraph | undefined,
      prevSubgraph: Subgraph | undefined
    ) => {
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
        if (isWorkflowSwitching) {
          // Defer restore until after loadGraphData applies extra.ds
          requestAnimationFrame(() => {
            restoreViewport(getCurrentRootGraphId())
          })
        } else {
          restoreViewport(getCurrentRootGraphId())
        }
        return
      }

      const path = findSubgraphPathById(subgraph.rootGraph, subgraph.id)
      const isInReachableSubgraph = !!path
      if (isInReachableSubgraph) {
        idStack.value = [...path]
      } else {
        idStack.value = [subgraph.id]
      }

      if (isWorkflowSwitching) {
        // Defer restore until after loadGraphData applies extra.ds
        const targetId = subgraph.id
        requestAnimationFrame(() => {
          restoreViewport(targetId)
        })
      } else {
        restoreViewport(subgraph.id)
      }
    }

    // ── Watchers ─────────────────────────────────────────────────────

    // React to subgraph navigation (enter/exit/switch).
    watch(
      () => workflowStore.activeSubgraph,
      (newValue, oldValue) => {
        onNavigated(newValue, oldValue)
      },
      { flush: 'sync' }
    )

    //Allow navigation with forward/back buttons
    let blockHashUpdate = false
    let initialLoad = true

    async function navigateToHash(newHash: string) {
      const root = app.rootGraph
      const locatorId = newHash?.slice(1) || root.id
      const canvas = canvasStore.getCanvas()
      if (canvas.graph?.id === locatorId) return
      const targetGraph =
        (locatorId || root.id) !== root.id
          ? root.subgraphs.get(locatorId)
          : root
      if (targetGraph) return canvas.setGraph(targetGraph)

      //Search all open workflows
      for (const workflow of workflowStore.openWorkflows) {
        const { activeState } = workflow
        if (!activeState) continue
        const subgraphs = activeState.definitions?.subgraphs ?? []
        for (const graph of [activeState, ...subgraphs]) {
          if (graph.id !== locatorId) continue
          //This will trigger a navigation, which can break forward history
          try {
            blockHashUpdate = true
            await useWorkflowService().openWorkflow(workflow)
          } finally {
            blockHashUpdate = false
          }
          const targetGraph =
            app.rootGraph.id === locatorId
              ? app.rootGraph
              : app.rootGraph.subgraphs.get(locatorId)
          if (!targetGraph) {
            console.error('subgraph poofed after load?')
            return
          }

          return canvas.setGraph(targetGraph)
        }
      }
    }

    async function updateHash() {
      if (blockHashUpdate) return
      if (initialLoad) {
        initialLoad = false
        if (!routeHash.value) return
        await navigateToHash(routeHash.value)
        const graph = canvasStore.getCanvas().graph
        if (isSubgraph(graph)) workflowStore.activeSubgraph = graph
        return
      }

      const newId = canvasStore.getCanvas().graph?.id ?? ''
      if (!routeHash.value) await router.replace('#' + app.rootGraph.id)
      const currentId = routeHash.value?.slice(1)
      if (!newId || newId === currentId) return

      await router.push('#' + newId)
    }
    //update navigation hash
    //NOTE: Doesn't apply on workflow load
    watch(() => canvasStore.currentGraph, updateHash)
    watch(routeHash, () => navigateToHash(String(routeHash.value)))

    /** Save the current viewport for the active graph/workflow. Called by
     *  workflowService.beforeLoadNewGraph() before the canvas is overwritten. */
    const saveCurrentViewport = () => {
      saveViewport(getActiveGraphId())
      isWorkflowSwitching = true
      requestAnimationFrame(() => {
        isWorkflowSwitching = false
      })
    }

    return {
      activeSubgraph,
      navigationStack,
      restoreState,
      exportState,
      saveViewport,
      restoreViewport,
      saveCurrentViewport,
      updateHash,
      viewportCache
    }
  }
)
