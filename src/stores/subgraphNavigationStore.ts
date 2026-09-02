import QuickLRU from '@alloc/quick-lru'
import { useRouteHash } from '@vueuse/router'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import {
  NavigationFailureType,
  isNavigationFailure,
  useRouter
} from 'vue-router'

import type { DragAndScaleState } from '@/lib/litegraph/src/DragAndScale'
import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasScheduler } from '@/renderer/core/canvas/useCanvasScheduler'
import { requestSlotLayoutSyncForAllNodes } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'
import { isUuidShapedSubgraphId } from '@/schemas/subgraphIdSchema'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
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
    const canvasScheduler = useCanvasScheduler()
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

      // First visit — fit to content so subgraph nodes are visible
      canvasScheduler.schedule(() => {
        if (getActiveGraphId() !== graphId) return
        if (!canvas.graph?.nodes?.length) return
        useLitegraphService().fitView()
        // Defer slot sync to the next frame so the browser paints the
        // new scale/offset from fitView before slot geometry is measured.
        requestAnimationFrame(() => {
          if (getActiveGraphId() !== graphId) return
          requestSlotLayoutSyncForAllNodes()
        })
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

    // Counter so nested/overlapping async navigations don't release
    // suppression early; gates both the canvasStore.currentGraph watcher
    // (updateHash) and the routeHash watcher to prevent re-entrant
    // navigateToHash calls during router.replace().
    let blockNavDepth = 0
    let initialLoad = true
    let hashUpdateTail: Promise<void> = Promise.resolve()
    type GraphNavigationIntent = {
      id: number
      hash: string
      source: 'graph' | 'route'
    }
    type NavigationIntent =
      | GraphNavigationIntent
      | { id: number; source: 'workflow' }
    const routeWriteStateKey = 'comfySubgraphNavigationWrite'
    const pendingRouteWrites = new Map<number, string>()
    // D14: the reset-suppression flag dies with shared-graph loading at
    // ECS per-document scoping; the intent ids guard the router and survive.
    let deferredNavigationIntent: GraphNavigationIntent | undefined
    let latestNavigationIntent: NavigationIntent | undefined
    let navigationIntentId = 0
    let routeWriteId = 0
    let blockedRouteHash: string | undefined
    let pendingWorkflowResetGraph: typeof app.rootGraph | undefined

    function createNavigationIntent(
      hash: string,
      source: GraphNavigationIntent['source']
    ): GraphNavigationIntent {
      const intent = { id: ++navigationIntentId, hash, source }
      latestNavigationIntent = intent
      return intent
    }

    function beginWorkflowNavigation(): number {
      const intent = { id: ++navigationIntentId, source: 'workflow' as const }
      latestNavigationIntent = intent
      return intent.id
    }

    /**
     * Releases a workflow-load intent whose load FAILED: while it stays the
     * newest intent it suppresses the surviving graph's hash forever, so
     * clear it and republish the live graph.
     */
    function endWorkflowNavigation(navigationId: number): void {
      if (
        latestNavigationIntent?.source !== 'workflow' ||
        latestNavigationIntent.id !== navigationId
      ) {
        return
      }
      latestNavigationIntent = undefined
      void updateHash('graph')
    }

    async function withNavBlocked<T>(
      op: () => Promise<T>,
      blockedHash: string
    ): Promise<T> {
      const previousBlockedRouteHash = blockedRouteHash
      blockedRouteHash = blockedHash
      blockNavDepth++
      try {
        return await op()
      } finally {
        blockNavDepth--
        blockedRouteHash = previousBlockedRouteHash
      }
    }

    function ensureCanvasOnRoot() {
      const root = app.rootGraph
      const canvas = canvasStore.getCanvas()
      if (!root || !canvas) return
      if (canvas.graph?.id !== root.id) canvas.setGraph(root)
    }

    async function redirectToRoot(reason: string, navigationId: number) {
      if (navigationId !== navigationIntentId) return
      const root = app.rootGraph
      const rootHash = '#' + root.id
      console.warn(`[subgraphNavigation] ${reason}; redirecting to root graph`)
      try {
        await withNavBlocked(() => writeRouteHash(rootHash, true), rootHash)
      } finally {
        if (navigationId === navigationIntentId) ensureCanvasOnRoot()
      }
    }

    async function navigateToHash(newHash: string, navigationId: number) {
      const root = app.rootGraph
      const locatorId = newHash?.slice(1) || root.id
      const canvas = canvasStore.getCanvas()

      const isRoot = locatorId === root.id
      const targetGraph = isRoot
        ? root
        : isUuidShapedSubgraphId(locatorId)
          ? root.subgraphs.get(locatorId)
          : undefined
      if (targetGraph) {
        if (canvas.graph?.id === targetGraph.id) return
        return withNavBlocked(async () => {
          canvas.setGraph(targetGraph)
        }, newHash)
      }

      //Search all open workflows
      for (const workflow of workflowStore.openWorkflows) {
        const { activeState } = workflow
        if (!activeState) continue
        const subgraphs = activeState.definitions?.subgraphs ?? []
        for (const graph of [activeState, ...subgraphs]) {
          if (graph.id !== locatorId) continue
          // This will trigger a navigation, which can break forward history.
          // After openWorkflow resolves, app.rootGraph has been swapped, so we
          // intentionally re-read app.rootGraph below instead of using the
          // `root` captured at function entry.
          try {
            await withNavBlocked(
              () =>
                useWorkflowService().openWorkflow(workflow, {
                  navigationIntentId: navigationId
                }),
              newHash
            )
          } catch (err) {
            if (navigationId !== navigationIntentId) return
            console.warn(
              '[subgraphNavigation] openWorkflow rejected during recovery',
              err
            )
            reportError(err, { errorType: 'workflow_navigation_failure' })
            return redirectToRoot('workflow load failed', navigationId)
          }
          if (navigationId !== navigationIntentId) return
          const loadedGraph =
            app.rootGraph.id === locatorId
              ? app.rootGraph
              : app.rootGraph.subgraphs.get(locatorId)
          if (!loadedGraph) {
            return redirectToRoot(
              'subgraph not found after workflow load',
              navigationId
            )
          }
          if (canvas.graph?.id === loadedGraph.id) return
          return withNavBlocked(async () => {
            canvas.setGraph(loadedGraph)
          }, newHash)
        }
      }

      await redirectToRoot(`subgraph not found: ${locatorId}`, navigationId)
    }

    async function safeRouterCall(op: () => Promise<unknown>, label: string) {
      try {
        await op()
      } catch (err) {
        if (
          !isNavigationFailure(err, NavigationFailureType.duplicated) &&
          !isNavigationFailure(err, NavigationFailureType.cancelled)
        ) {
          console.warn(`[subgraphNavigation] ${label} rejected`, err)
        }
      }
    }

    async function writeRouteHash(hash: string, replace: boolean) {
      const writeId = ++routeWriteId
      pendingRouteWrites.set(writeId, hash)
      const target = {
        hash,
        state: { [routeWriteStateKey]: writeId }
      }
      try {
        await safeRouterCall(
          () => (replace ? router.replace(target) : router.push(target)),
          replace ? 'router.replace' : 'router.push'
        )
      } finally {
        pendingRouteWrites.delete(writeId)
      }
    }

    async function syncGraphHash(intent: GraphNavigationIntent) {
      if (intent.id !== navigationIntentId) return
      if (!routeHash.value) {
        const rootHash = '#' + app.rootGraph.id
        await writeRouteHash(rootHash, true)
        if (intent.id !== navigationIntentId) return
      }
      const currentId = routeHash.value?.slice(1)
      if (intent.hash.slice(1) === currentId) return

      await writeRouteHash(intent.hash, false)
    }

    function queueGraphHash(intent: GraphNavigationIntent): Promise<void> {
      const result = hashUpdateTail.then(() => syncGraphHash(intent))
      hashUpdateTail = result.catch(() => undefined)
      return result
    }

    async function applyNavigationIntent(intent: GraphNavigationIntent) {
      await navigateToHash(intent.hash, intent.id)
      if (blockNavDepth > 0) return

      const deferredIntent = deferredNavigationIntent
      if (deferredIntent?.id === navigationIntentId) {
        deferredNavigationIntent = undefined
        return applyNavigationIntent(deferredIntent)
      }

      if (intent.source === 'graph' && intent.id === navigationIntentId) {
        await queueGraphHash(intent)
      }
    }

    async function updateHash(
      source: 'graph' | 'workflow-load' = 'graph',
      workflowNavigationId?: number,
      currentGraph?: LGraph | null
    ): Promise<void> {
      const graph = currentGraph ?? canvasStore.getCanvas().graph
      if (source === 'workflow-load') {
        pendingWorkflowResetGraph = undefined
        if (
          blockNavDepth > 0 &&
          workflowNavigationId === navigationIntentId &&
          latestNavigationIntent?.source === 'workflow' &&
          graph?.id
        ) {
          deferredNavigationIntent = {
            id: workflowNavigationId,
            hash: '#' + graph.id,
            source: 'graph'
          }
          return Promise.resolve()
        }
        if (blockNavDepth > 0) return Promise.resolve()
        if (workflowNavigationId !== undefined) {
          if (workflowNavigationId !== navigationIntentId) {
            const latestIntent = latestNavigationIntent
            return latestIntent && latestIntent.source !== 'workflow'
              ? applyNavigationIntent(latestIntent)
              : Promise.resolve()
          }
        }
      }
      if (graph === pendingWorkflowResetGraph) {
        pendingWorkflowResetGraph = undefined
        return Promise.resolve()
      }

      const newId = graph?.id ?? ''
      if (initialLoad) {
        initialLoad = false
        if (!routeHash.value) return Promise.resolve()
        return applyNavigationIntent(
          createNavigationIntent(String(routeHash.value), 'route')
        ).then(() => {
          const activeGraph = canvasStore.getCanvas().graph
          if (isSubgraph(activeGraph)) {
            workflowStore.activeSubgraph = activeGraph
          }
        })
      }

      if (!newId) return Promise.resolve()
      const newHash = '#' + newId
      if (newHash === routeHash.value) return Promise.resolve()
      if (blockNavDepth > 0 && newHash === blockedRouteHash) {
        return Promise.resolve()
      }

      const intent = createNavigationIntent(newHash, 'graph')
      if (blockNavDepth > 0) {
        deferredNavigationIntent = intent
        return Promise.resolve()
      }

      return queueGraphHash(intent)
    }
    watch(
      () => canvasStore.currentGraph,
      (graph) => void updateHash('graph', undefined, graph),
      { flush: 'sync' }
    )
    watch(
      routeHash,
      (newHash) => {
        initialLoad = false
        const hash = String(newHash)
        const stateWriteId = router.options.history.state[routeWriteStateKey]
        if (
          typeof stateWriteId === 'number' &&
          pendingRouteWrites.get(stateWriteId) === hash
        ) {
          pendingRouteWrites.delete(stateWriteId)
          return
        }
        const intent = createNavigationIntent(hash, 'route')
        if (blockNavDepth > 0) {
          deferredNavigationIntent = intent
          return
        }
        void applyNavigationIntent(intent)
      },
      { flush: 'sync' }
    )

    /** Save the current viewport for the active graph/workflow. Called by
     *  workflowService.beforeLoadNewGraph() before the canvas is overwritten. */
    function saveCurrentViewport(suppressWorkflowReset = true): void {
      saveViewport(getActiveGraphId())
      const graph = canvasStore.getCanvas().graph
      pendingWorkflowResetGraph =
        suppressWorkflowReset && graph !== app.rootGraph
          ? app.rootGraph
          : undefined
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
      beginWorkflowNavigation,
      endWorkflowNavigation,
      updateHash,
      /** @internal Exposed for test assertions only. */
      viewportCache
    }
  }
)
