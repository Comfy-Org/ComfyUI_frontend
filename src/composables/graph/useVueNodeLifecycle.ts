import { createSharedComposable, whenever } from '@vueuse/core'
import { shallowRef, watch } from 'vue'

import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLayoutSync } from '@/renderer/core/layout/sync/useLayoutSync'
import { app as comfyApp } from '@/scripts/app'

/**
 * Owns the Layout↔LiteGraph sync lifecycle and drops view-scoped geometry when
 * the viewed graph changes.
 *
 * Node geometry is not seeded here: entries are registered and removed with the
 * node itself, in `LGraph.add` / `LGraph.remove`, as they already were for
 * groups and reroutes.
 */
function useVueNodeLifecycleIndividual() {
  const canvasStore = useCanvasStore()
  const { shouldRenderVueNodes } = useVueFeatureFlags()
  const isInitialized = shallowRef(false)
  const { startSync, stopSync } = useLayoutSync()

  const initializeVueNodeLayout = () => {
    if (!comfyApp.canvas?.graph || isInitialized.value) return
    isInitialized.value = true

    layoutStore.clearViewGeometry()

    // Start sync AFTER the reset so bootstrap operations don't trigger the
    // Layout→LiteGraph writeback loop redundantly.
    startSync(canvasStore.canvas)
  }

  const disposeVueNodeLayout = () => {
    stopSync()
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

  return {
    initializeVueNodeLayout,
    disposeVueNodeLayout
  }
}

export const useVueNodeLifecycle = createSharedComposable(
  useVueNodeLifecycleIndividual
)
