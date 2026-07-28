import {
  createSharedComposable,
  useEventListener,
  whenever
} from '@vueuse/core'
import { shallowRef, watch } from 'vue'

import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import type { NodeLifecycleEvent } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useLayoutSync } from '@/renderer/core/layout/sync/useLayoutSync'
import { app as comfyApp } from '@/scripts/app'

/**
 * Bootstraps the renderer's layout view of the active graph and owns the
 * Layout↔LiteGraph sync lifecycle. Re-seeds the whole active graph on entry —
 * which is what makes subgraph navigation show the right nodes — then keeps it
 * current from the graph's node lifecycle events.
 *
 * Seeding lives here rather than in `LGraph.add` so `layoutStore` stays empty
 * while the Vue renderer is off, and holds only the graph being viewed.
 */
function useVueNodeLifecycleIndividual() {
  const canvasStore = useCanvasStore()
  const layoutMutations = useLayoutMutations()
  const { shouldRenderVueNodes } = useVueFeatureFlags()
  const isInitialized = shallowRef(false)
  const { startSync, stopSync } = useLayoutSync()
  let stopNodeListeners: (() => void) | null = null

  const seedNodeLayout = (node: LGraphNode) => {
    layoutMutations.setSource(LayoutSource.Canvas)
    layoutMutations.createNode(node.id, {
      position: { x: node.pos[0], y: node.pos[1] },
      size: { width: node.size[0], height: node.size[1] },
      zIndex: node.order || 0,
      visible: true
    })
  }

  const initializeVueNodeLayout = () => {
    // Use canvas graph if available (handles subgraph contexts), fallback to app graph
    const activeGraph = comfyApp.canvas?.graph
    if (!activeGraph || isInitialized.value) return
    isInitialized.value = true

    const nodes = activeGraph._nodes.map((node: LGraphNode) => ({
      id: node.id,
      pos: [node.pos[0], node.pos[1]] as [number, number],
      size: [node.size[0], node.size[1]] as [number, number]
    }))
    layoutStore.initializeFromLiteGraph(nodes)

    // Deserialised reroutes bypass createReroute, so they need seeding here for
    // hit-testing to find them.
    for (const reroute of activeGraph.reroutes.values()) {
      const [x, y] = reroute.pos
      layoutMutations.createReroute(reroute.id, { x, y })
    }

    // While configuring, geometry is still placeholder; the `pos`/`size` setters
    // write through to the store, so the entry catches up as the real values
    // land and no deferral is needed.
    const onNodeAdded = ({ detail: { node } }: NodeLifecycleEvent) =>
      seedNodeLayout(node)
    const onNodeRemoved = ({ detail: { node } }: NodeLifecycleEvent) => {
      layoutMutations.setSource(LayoutSource.Canvas)
      layoutMutations.deleteNode(node.id)
    }
    const stopAdded = useEventListener(
      activeGraph.events,
      'node:added',
      onNodeAdded
    )
    const stopRemoved = useEventListener(
      activeGraph.events,
      'node:removed',
      onNodeRemoved
    )
    stopNodeListeners = () => {
      stopAdded()
      stopRemoved()
    }

    // Start sync AFTER seeding so bootstrap operations don't trigger
    // the Layout→LiteGraph writeback loop redundantly.
    startSync(canvasStore.canvas)
  }

  const disposeVueNodeLayout = () => {
    stopSync()
    stopNodeListeners?.()
    stopNodeListeners = null
    isInitialized.value = false
  }

  // Watch for Vue nodes enabled state changes
  watch(
    () => shouldRenderVueNodes.value && Boolean(comfyApp.canvas?.graph),
    (enabled) => {
      if (enabled) {
        initializeVueNodeLayout()
      }
    },
    { immediate: true }
  )

  whenever(
    () => !shouldRenderVueNodes.value,
    () => {
      disposeVueNodeLayout()

      // Force arrange() on all nodes so input.pos is computed before
      // the first legacy drawConnections frame (which may run before
      // drawNode on the foreground canvas).
      const graph = comfyApp.canvas?.graph
      if (!graph) {
        comfyApp.canvas?.setDirty(true, true)
        return
      }
      for (const node of graph._nodes) {
        if (node.flags.collapsed) continue
        try {
          node.arrange()
        } catch {
          /* skip nodes not fully initialized */
        }
      }

      comfyApp.canvas?.setDirty(true, true)
    }
  )

  // Clear stale slot layouts when switching modes
  watch(
    () => shouldRenderVueNodes.value,
    () => {
      layoutStore.clearAllSlotLayouts()
    }
  )

  /**
   * When the canvas mounts before its first node exists, bootstrap is deferred
   * to the first add.
   */
  const setupEmptyGraphListener = () => {
    const activeGraph = comfyApp.canvas?.graph
    if (
      !shouldRenderVueNodes.value ||
      isInitialized.value ||
      activeGraph?._nodes.length !== 0
    ) {
      return
    }
    useEventListener(
      activeGraph.events,
      'node:added',
      () => {
        if (shouldRenderVueNodes.value) initializeVueNodeLayout()
      },
      { once: true }
    )
  }

  return {
    initializeVueNodeLayout,
    disposeVueNodeLayout,
    setupEmptyGraphListener
  }
}

export const useVueNodeLifecycle = createSharedComposable(
  useVueNodeLifecycleIndividual
)
