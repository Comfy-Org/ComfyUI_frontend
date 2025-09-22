/**
 * Vue Nodes Viewport Culling
 *
 * Principles:
 * 1. Query DOM directly using data attributes (no cache to maintain)
 * 2. Set display none on element to avoid cascade resolution overhead
 * 3. Only run when transform changes (event driven)
 */
import { useThrottleFn } from '@vueuse/core'
import { computed } from 'vue'

import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app as comfyApp } from '@/scripts/app'

export function useViewportCulling() {
  const canvasStore = useCanvasStore()
  const { vueNodeData, nodeManager } = useVueNodeLifecycle()

  const allNodes = computed(() => {
    return Array.from(vueNodeData.value.values())
  })

  /**
   * Update visibility of all nodes based on viewport
   * Queries DOM directly - no cache maintenance needed
   */
  function updateVisibility() {
    if (!nodeManager.value || !canvasStore.canvas || !comfyApp.canvas) return

    const canvas = canvasStore.canvas
    const manager = nodeManager.value
    const ds = canvas.ds

    // Viewport bounds
    const viewport_width = canvas.canvas.width
    const viewport_height = canvas.canvas.height
    const margin = 500 * ds.scale

    // Get all node elements at once
    const nodeElements = document.querySelectorAll('[data-node-id]')

    // Update each element's visibility
    for (const element of nodeElements) {
      const nodeId = element.getAttribute('data-node-id')
      if (!nodeId) continue

      const node = manager.getNode(nodeId)
      if (!node) continue

      // Calculate if node is outside viewport
      const screen_x = (node.pos[0] + ds.offset[0]) * ds.scale
      const screen_y = (node.pos[1] + ds.offset[1]) * ds.scale
      const screen_width = node.size[0] * ds.scale
      const screen_height = node.size[1] * ds.scale

      const isNodeOutsideViewport =
        screen_x + screen_width < -margin ||
        screen_x > viewport_width + margin ||
        screen_y + screen_height < -margin ||
        screen_y > viewport_height + margin

      // Setting display none directly avoid potential cascade resolution
      if (element instanceof HTMLElement) {
        element.style.display = isNodeOutsideViewport ? 'none' : ''
      }
    }
  }

  const updateVisibilityDebounced = useThrottleFn(updateVisibility, 20)

  // RAF throttling for smooth updates during continuous panning
  function handleTransformUpdate() {
    requestAnimationFrame(async () => {
      await updateVisibilityDebounced()
    })
  }

  return {
    allNodes,
    handleTransformUpdate
  }
}
