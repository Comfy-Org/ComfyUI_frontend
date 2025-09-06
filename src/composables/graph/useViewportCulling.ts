/**
 * Viewport Culling Composable
 *
 * Handles viewport culling optimization for Vue nodes including:
 * - Transform state synchronization
 * - Visible node calculation with screen space transforms
 * - Adaptive margin computation based on zoom level
 * - Performance optimizations for large graphs
 */
import { type Ref, computed, readonly, ref } from 'vue'

import { useTransformState } from '@/renderer/core/layout/useTransformState'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { app as comfyApp } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'

interface NodeManager {
  getNode: (id: string) => any
}

export function useViewportCulling(
  isVueNodesEnabled: Ref<boolean>,
  vueNodeData: Ref<ReadonlyMap<string, VueNodeData>>,
  nodeDataTrigger: Ref<number>,
  nodeManager: Ref<NodeManager | null>
) {
  const canvasStore = useCanvasStore()
  const { syncWithCanvas } = useTransformState()

  // Transform tracking for performance optimization - reactive
  const lastScale = ref(1)
  const lastOffsetX = ref(0)
  const lastOffsetY = ref(0)

  // Computed properties for transform state
  const currentTransformState = computed(() => ({
    scale: lastScale.value,
    offsetX: lastOffsetX.value,
    offsetY: lastOffsetY.value
  }))

  /**
   * Computed property that returns nodes visible in the current viewport
   * Implements sophisticated culling algorithm with adaptive margins
   */
  const nodesToRender = computed(() => {
    if (!isVueNodesEnabled.value) {
      return []
    }

    // Access trigger to force re-evaluation after nodeManager initialization
    void nodeDataTrigger.value

    if (!comfyApp.graph) {
      return []
    }

    const allNodes = Array.from(vueNodeData.value.values())

    // Apply viewport culling - check if node bounds intersect with viewport
    // TODO: use quadtree
    if (nodeManager.value && canvasStore.canvas && comfyApp.canvas) {
      const canvas = canvasStore.canvas
      const manager = nodeManager.value

      // Ensure transform is synced before checking visibility
      syncWithCanvas(comfyApp.canvas)

      const ds = canvas.ds

      // Work in screen space - viewport is simply the canvas element size
      const viewport_width = canvas.canvas.width
      const viewport_height = canvas.canvas.height

      // Add margin that represents a constant distance in canvas space
      // Convert canvas units to screen pixels by multiplying by scale
      const canvasMarginDistance = 200 // Fixed margin in canvas units
      const margin_x = canvasMarginDistance * ds.scale
      const margin_y = canvasMarginDistance * ds.scale

      const filtered = allNodes.filter((nodeData) => {
        const node = manager.getNode(nodeData.id)
        if (!node) return false

        // Transform node position to screen space (same as DOM widgets)
        const screen_x = (node.pos[0] + ds.offset[0]) * ds.scale
        const screen_y = (node.pos[1] + ds.offset[1]) * ds.scale
        const screen_width = node.size[0] * ds.scale
        const screen_height = node.size[1] * ds.scale

        // Check if node bounds intersect with expanded viewport (in screen space)
        const isVisible = !(
          screen_x + screen_width < -margin_x ||
          screen_x > viewport_width + margin_x ||
          screen_y + screen_height < -margin_y ||
          screen_y > viewport_height + margin_y
        )

        return isVisible
      })

      return filtered
    }

    return allNodes
  })

  /**
   * Handle transform updates with performance optimization
   * Only syncs when transform actually changes to avoid unnecessary reflows
   */
  const handleTransformUpdate = (detectChangesInRAF: () => void) => {
    // Skip all work if Vue nodes are disabled
    if (!isVueNodesEnabled.value) {
      return
    }

    // Sync transform state only when it changes (avoids reflows)
    if (comfyApp.canvas?.ds) {
      const currentScale = comfyApp.canvas.ds.scale
      const currentOffsetX = comfyApp.canvas.ds.offset[0]
      const currentOffsetY = comfyApp.canvas.ds.offset[1]

      if (
        currentScale !== lastScale.value ||
        currentOffsetX !== lastOffsetX.value ||
        currentOffsetY !== lastOffsetY.value
      ) {
        syncWithCanvas(comfyApp.canvas)
        lastScale.value = currentScale
        lastOffsetX.value = currentOffsetX
        lastOffsetY.value = currentOffsetY
      }
    }

    // Detect node changes during transform updates
    detectChangesInRAF()

    // Trigger reactivity for nodesToRender
    void nodesToRender.value.length
  }

  /**
   * Calculate if a specific node is visible in viewport
   * Useful for individual node visibility checks
   */
  const isNodeVisible = (nodeData: VueNodeData): boolean => {
    if (!nodeManager.value || !canvasStore.canvas || !comfyApp.canvas) {
      return true // Default to visible if culling not available
    }

    const canvas = canvasStore.canvas
    const node = nodeManager.value.getNode(nodeData.id)
    if (!node) return false

    syncWithCanvas(comfyApp.canvas)
    const ds = canvas.ds

    const viewport_width = canvas.canvas.width
    const viewport_height = canvas.canvas.height
    const canvasMarginDistance = 200
    const margin_x = canvasMarginDistance * ds.scale
    const margin_y = canvasMarginDistance * ds.scale

    const screen_x = (node.pos[0] + ds.offset[0]) * ds.scale
    const screen_y = (node.pos[1] + ds.offset[1]) * ds.scale
    const screen_width = node.size[0] * ds.scale
    const screen_height = node.size[1] * ds.scale

    return !(
      screen_x + screen_width < -margin_x ||
      screen_x > viewport_width + margin_x ||
      screen_y + screen_height < -margin_y ||
      screen_y > viewport_height + margin_y
    )
  }

  /**
   * Get viewport bounds information for debugging
   */
  const getViewportInfo = () => {
    if (!canvasStore.canvas || !comfyApp.canvas) {
      return null
    }

    const canvas = canvasStore.canvas
    const ds = canvas.ds

    return {
      viewport_width: canvas.canvas.width,
      viewport_height: canvas.canvas.height,
      scale: ds.scale,
      offset: [ds.offset[0], ds.offset[1]],
      margin_distance: 200,
      margin_x: 200 * ds.scale,
      margin_y: 200 * ds.scale
    }
  }

  return {
    nodesToRender,
    handleTransformUpdate,
    isNodeVisible,
    getViewportInfo,

    // Reactive transform state
    currentTransformState: readonly(currentTransformState),
    lastScale: readonly(lastScale),
    lastOffsetX: readonly(lastOffsetX),
    lastOffsetY: readonly(lastOffsetY)
  }
}
