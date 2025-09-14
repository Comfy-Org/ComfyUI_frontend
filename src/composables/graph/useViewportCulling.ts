/**
 * Vue Nodes Viewport Culling
 *
 * Principles:
 * 1. Query DOM directly using data attributes (no cache to maintain)
 * 2. Set display none on element to avoid cascade resolution overhead
 * 3. Only run when transform changes (event driven)
 */
import { type Ref, computed } from 'vue'

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

  const allNodes = computed(() => {
    if (!isVueNodesEnabled.value) return []
    void nodeDataTrigger.value // Force re-evaluation when nodeManager initializes
    return Array.from(vueNodeData.value.values())
  })

  /**
   * Update visibility of all nodes based on viewport
   * Queries DOM directly - no cache maintenance needed
   */
  const updateVisibility = () => {
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

  // RAF throttling for smooth updates during continuous panning
  let rafId: number | null = null

  /**
   * Handle transform update - called by TransformPane event
   * Uses RAF to batch updates for smooth performance
   */
  const handleTransformUpdate = () => {
    if (!isVueNodesEnabled.value) return

    // Cancel previous RAF if still pending
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    // Schedule update in next animation frame
    rafId = requestAnimationFrame(() => {
      updateVisibility()
      rafId = null
    })
  }

  return {
    allNodes,
    handleTransformUpdate,
    updateVisibility
  }
}
