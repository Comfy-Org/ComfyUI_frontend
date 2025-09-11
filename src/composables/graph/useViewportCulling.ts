/**
 * Viewport Culling Composable
 *
 * Handles viewport culling optimization for Vue nodes including:
 * - Transform state synchronization
 * - Visible node calculation with screen space transforms
 * - Adaptive margin computation based on zoom level
 * - Performance optimizations for large graphs
 */
import { type Ref, computed, onUnmounted, readonly, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useTransformState } from '@/renderer/core/layout/useTransformState'
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

  // Transform tracking for performance optimization
  // Initialize with canvas values if available
  const lastScale = ref(comfyApp.canvas?.ds?.scale ?? 1)
  const lastOffsetX = ref(comfyApp.canvas?.ds?.offset?.[0] ?? 0)
  const lastOffsetY = ref(comfyApp.canvas?.ds?.offset?.[1] ?? 0)

  // Viewport tracking for efficient culling updates
  // Only update culling when viewport changes significantly
  const viewportScale = ref(lastScale.value)
  const viewportOffsetX = ref(lastOffsetX.value)
  const viewportOffsetY = ref(lastOffsetY.value)

  // Threshold for viewport changes (in canvas units)
  const VIEWPORT_UPDATE_THRESHOLD = 50 // Update culling when moved 50+ canvas units
  const SCALE_UPDATE_THRESHOLD = 0.1 // Update culling when scale changes by 10%+

  // Debounced update for final viewport position
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const updateViewportDebounced = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      // Force viewport update after panning stops
      if (comfyApp.canvas?.ds) {
        viewportScale.value = comfyApp.canvas.ds.scale
        viewportOffsetX.value = comfyApp.canvas.ds.offset[0]
        viewportOffsetY.value = comfyApp.canvas.ds.offset[1]
      }
    }, 150) // Update 150ms after panning stops
  }

  // Current transform state
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

    // IMPORTANT: Use viewport refs for culling, not the constantly updating transform refs
    // This prevents re-evaluation on every frame during panning
    const currentScale = viewportScale.value
    const currentOffsetX = viewportOffsetX.value
    const currentOffsetY = viewportOffsetY.value

    if (!comfyApp.graph) {
      return []
    }

    const allNodes = Array.from(vueNodeData.value.values())

    // Apply viewport culling - check if node bounds intersect with viewport
    // TODO: use quadtree
    if (nodeManager.value && canvasStore.canvas && comfyApp.canvas) {
      const canvas = canvasStore.canvas
      const manager = nodeManager.value

      // Use the reactive transform values instead of directly reading from canvas.ds
      // This ensures Vue tracks these as dependencies
      const scale = currentScale
      const offsetX = currentOffsetX
      const offsetY = currentOffsetY

      // Work in screen space - viewport is simply the canvas element size
      const viewport_width = canvas.canvas.width
      const viewport_height = canvas.canvas.height

      // Add margin that represents a constant distance in canvas space
      // Convert canvas units to screen pixels by multiplying by scale
      const canvasMarginDistance = 200 // Fixed margin in canvas units
      const margin_x = canvasMarginDistance * scale
      const margin_y = canvasMarginDistance * scale

      const filtered = allNodes.filter((nodeData) => {
        const node = manager.getNode(nodeData.id)
        if (!node) return false

        // Transform node position to screen space (same as DOM widgets)
        const screen_x = (node.pos[0] + offsetX) * scale
        const screen_y = (node.pos[1] + offsetY) * scale
        const screen_width = node.size[0] * scale
        const screen_height = node.size[1] * scale

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
        // Update transform tracking refs
        lastScale.value = currentScale
        lastOffsetX.value = currentOffsetX
        lastOffsetY.value = currentOffsetY

        // Only update viewport refs (triggering culling recalc) if change is significant
        const scaleDiff =
          Math.abs(currentScale - viewportScale.value) / viewportScale.value
        const offsetDiffX = Math.abs(currentOffsetX - viewportOffsetX.value)
        const offsetDiffY = Math.abs(currentOffsetY - viewportOffsetY.value)

        if (
          scaleDiff > SCALE_UPDATE_THRESHOLD ||
          offsetDiffX > VIEWPORT_UPDATE_THRESHOLD ||
          offsetDiffY > VIEWPORT_UPDATE_THRESHOLD
        ) {
          // Significant viewport change - update culling
          viewportScale.value = currentScale
          viewportOffsetX.value = currentOffsetX
          viewportOffsetY.value = currentOffsetY
        } else {
          // Small change - schedule debounced update for when panning stops
          updateViewportDebounced()
        }
      }
    }

    // Detect node changes during transform updates
    detectChangesInRAF()
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

  // Cleanup on unmount
  onUnmounted(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  })

  return {
    nodesToRender,
    handleTransformUpdate,
    isNodeVisible,
    getViewportInfo,

    // Transform state
    currentTransformState: readonly(currentTransformState),
    lastScale: readonly(lastScale),
    lastOffsetX: readonly(lastOffsetX),
    lastOffsetY: readonly(lastOffsetY)
  }
}
