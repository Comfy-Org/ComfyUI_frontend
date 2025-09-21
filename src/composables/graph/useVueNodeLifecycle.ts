/**
 * Vue Node Lifecycle Management Composable
 *
 * Handles the complete lifecycle of Vue node rendering system including:
 * - Node manager initialization and cleanup
 * - Layout store synchronization
 * - Slot and link sync management
 * - Reactive state management for node data, positions, and sizes
 * - Memory management and proper cleanup
 */
import { createSharedComposable } from '@vueuse/core'
import { computed, readonly, ref, shallowRef, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import type {
  GraphNodeManager,
  NodeState,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLayoutSync } from '@/renderer/core/layout/sync/useLayoutSync'
import { useLinkLayoutSync } from '@/renderer/core/layout/sync/useLinkLayoutSync'
import { useSlotLayoutSync } from '@/renderer/core/layout/sync/useSlotLayoutSync'
import { app as comfyApp } from '@/scripts/app'

function useVueNodeLifecycleIndividual() {
  const canvasStore = useCanvasStore()
  const layoutMutations = useLayoutMutations()
  const { shouldRenderVueNodes } = useVueFeatureFlags()

  const nodeManager = shallowRef<GraphNodeManager | null>(null)
  const cleanupNodeManager = shallowRef<(() => void) | null>(null)

  // Sync management
  const slotSync = shallowRef<ReturnType<typeof useSlotLayoutSync> | null>(null)
  const slotSyncStarted = ref(false)
  const linkSync = shallowRef<ReturnType<typeof useLinkLayoutSync> | null>(null)

  // Vue node data state
  const vueNodeData = ref<ReadonlyMap<string, VueNodeData>>(new Map())
  const nodeState = ref<ReadonlyMap<string, NodeState>>(new Map())
  const nodeSizes = ref<ReadonlyMap<string, { width: number; height: number }>>(
    new Map()
  )

  // Change detection function
  const detectChangesInRAF = ref<() => void>(() => {})

  // Trigger for forcing computed re-evaluation
  const nodeDataTrigger = ref(0)

  const isNodeManagerReady = computed(() => nodeManager.value !== null)

  const initializeNodeManager = () => {
    // Use canvas graph if available (handles subgraph contexts), fallback to app graph
    const activeGraph = comfyApp.canvas?.graph || comfyApp.graph
    if (!activeGraph || nodeManager.value) return

    // Initialize the core node manager
    const manager = useGraphNodeManager(activeGraph)
    nodeManager.value = manager
    cleanupNodeManager.value = manager.cleanup

    // Use the manager's data maps
    vueNodeData.value = manager.vueNodeData
    nodeState.value = manager.nodeState
    nodeSizes.value = manager.nodeSizes
    detectChangesInRAF.value = manager.detectChangesInRAF

    // Initialize layout system with existing nodes from active graph
    const nodes = activeGraph._nodes.map((node: LGraphNode) => ({
      id: node.id.toString(),
      pos: [node.pos[0], node.pos[1]] as [number, number],
      size: [node.size[0], node.size[1]] as [number, number]
    }))
    layoutStore.initializeFromLiteGraph(nodes)

    // Seed reroutes into the Layout Store so hit-testing uses the new path
    for (const reroute of activeGraph.reroutes.values()) {
      const [x, y] = reroute.pos
      const parent = reroute.parentId ?? undefined
      const linkIds = Array.from(reroute.linkIds)
      layoutMutations.createReroute(reroute.id, { x, y }, parent, linkIds)
    }

    // Seed existing links into the Layout Store (topology only)
    for (const link of activeGraph._links.values()) {
      layoutMutations.createLink(
        link.id,
        link.origin_id,
        link.origin_slot,
        link.target_id,
        link.target_slot
      )
    }

    // Initialize layout sync (one-way: Layout Store → LiteGraph)
    const { startSync } = useLayoutSync()
    startSync(canvasStore.canvas)

    // Initialize link layout sync for event-driven updates
    const linkSyncManager = useLinkLayoutSync()
    linkSync.value = linkSyncManager
    if (comfyApp.canvas) {
      linkSyncManager.start(comfyApp.canvas)
    }

    // Force computed properties to re-evaluate
    nodeDataTrigger.value++
  }

  const disposeNodeManagerAndSyncs = () => {
    if (!nodeManager.value) return

    try {
      cleanupNodeManager.value?.()
    } catch {
      /* empty */
    }
    nodeManager.value = null
    cleanupNodeManager.value = null

    // Clean up link layout sync
    if (linkSync.value) {
      linkSync.value.stop()
      linkSync.value = null
    }

    // Reset reactive maps to clean state
    vueNodeData.value = new Map()
    nodeState.value = new Map()
    nodeSizes.value = new Map()

    // Reset change detection function
    detectChangesInRAF.value = () => {}
  }

  // Watch for Vue nodes enabled state changes
  watch(
    () =>
      shouldRenderVueNodes.value &&
      Boolean(comfyApp.canvas?.graph || comfyApp.graph),
    (enabled) => {
      if (enabled) {
        initializeNodeManager()
      } else {
        disposeNodeManagerAndSyncs()
      }
    },
    { immediate: true }
  )

  // Consolidated watch for slot layout sync management
  watch(
    [() => canvasStore.canvas, () => shouldRenderVueNodes.value],
    ([canvas, vueMode], [, oldVueMode]) => {
      const modeChanged = vueMode !== oldVueMode

      // Clear stale slot layouts when switching modes
      if (modeChanged) {
        layoutStore.clearAllSlotLayouts()
      }

      // Switching to Vue
      if (vueMode && slotSyncStarted.value) {
        slotSync.value?.stop()
        slotSyncStarted.value = false
      }

      // Switching to LG
      const shouldRun = Boolean(canvas?.graph) && !vueMode
      if (shouldRun && !slotSyncStarted.value && canvas) {
        // Initialize slot sync if not already created
        if (!slotSync.value) {
          slotSync.value = useSlotLayoutSync()
        }
        const started = slotSync.value.attemptStart(canvas as LGraphCanvas)
        slotSyncStarted.value = started
      }
    },
    { immediate: true }
  )

  // Handle case where Vue nodes are enabled but graph starts empty
  const setupEmptyGraphListener = () => {
    if (
      shouldRenderVueNodes.value &&
      comfyApp.graph &&
      !nodeManager.value &&
      comfyApp.graph._nodes.length === 0
    ) {
      const originalOnNodeAdded = comfyApp.graph.onNodeAdded
      comfyApp.graph.onNodeAdded = function (node: LGraphNode) {
        // Restore original handler
        comfyApp.graph.onNodeAdded = originalOnNodeAdded

        // Initialize node manager if needed
        if (shouldRenderVueNodes.value && !nodeManager.value) {
          initializeNodeManager()
        }

        // Call original handler
        if (originalOnNodeAdded) {
          originalOnNodeAdded.call(this, node)
        }
      }
    }
  }

  // Cleanup function for component unmounting
  const cleanup = () => {
    if (nodeManager.value) {
      nodeManager.value.cleanup()
      nodeManager.value = null
    }
    if (slotSyncStarted.value) {
      slotSync.value?.stop()
      slotSyncStarted.value = false
    }
    slotSync.value = null
    if (linkSync.value) {
      linkSync.value.stop()
      linkSync.value = null
    }
  }

  return {
    vueNodeData,
    nodeState,
    nodeSizes,
    nodeDataTrigger: readonly(nodeDataTrigger),
    nodeManager: readonly(nodeManager),
    detectChangesInRAF: readonly(detectChangesInRAF),
    isNodeManagerReady,

    // Lifecycle methods
    initializeNodeManager,
    disposeNodeManagerAndSyncs,
    setupEmptyGraphListener,
    cleanup
  }
}

export const useVueNodeLifecycle = createSharedComposable(
  useVueNodeLifecycleIndividual
)
