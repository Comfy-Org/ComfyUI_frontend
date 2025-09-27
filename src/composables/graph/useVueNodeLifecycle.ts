import { createSharedComposable } from '@vueuse/core'
import { shallowRef, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import type { GraphNodeManager } from '@/composables/graph/useGraphNodeManager'
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

  const { startSync } = useLayoutSync()
  const linkSyncManager = useLinkLayoutSync()
  const slotSyncManager = useSlotLayoutSync()

  const initializeNodeManager = () => {
    // Use canvas graph if available (handles subgraph contexts), fallback to app graph
    const activeGraph = comfyApp.canvas?.graph
    if (!activeGraph || nodeManager.value) return

    // Initialize the core node manager
    const manager = useGraphNodeManager(activeGraph)
    nodeManager.value = manager

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
    startSync(canvasStore.canvas)

    if (comfyApp.canvas) {
      linkSyncManager.start(comfyApp.canvas)
    }
  }

  const disposeNodeManagerAndSyncs = () => {
    if (!nodeManager.value) return

    try {
      nodeManager.value.cleanup()
    } catch {
      /* empty */
    }
    nodeManager.value = null

    linkSyncManager.stop()
  }

  // Watch for Vue nodes enabled state changes
  watch(
    () => shouldRenderVueNodes.value && Boolean(comfyApp.canvas?.graph),
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
      if (vueMode) {
        slotSyncManager.stop()
      }

      // Switching to LG
      const shouldRun = Boolean(canvas?.graph) && !vueMode
      if (shouldRun && canvas) {
        slotSyncManager.attemptStart(canvas as LGraphCanvas)
      }
    },
    { immediate: true }
  )

  // Handle case where Vue nodes are enabled but graph starts empty
  const setupEmptyGraphListener = () => {
    const activeGraph = comfyApp.canvas?.graph
    if (
      !shouldRenderVueNodes.value ||
      nodeManager.value ||
      activeGraph?._nodes.length !== 0
    ) {
      return
    }
    const originalOnNodeAdded = activeGraph.onNodeAdded
    activeGraph.onNodeAdded = function (node: LGraphNode) {
      // Restore original handler
      activeGraph.onNodeAdded = originalOnNodeAdded

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

  // Cleanup function for component unmounting
  const cleanup = () => {
    if (nodeManager.value) {
      nodeManager.value.cleanup()
      nodeManager.value = null
    }
    slotSyncManager.stop()
    linkSyncManager.stop()
  }

  return {
    nodeManager,

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
