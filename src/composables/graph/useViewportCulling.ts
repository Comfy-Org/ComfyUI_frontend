/**
 * Viewport Culling - Direct DOM manipulation with element caching
 *
 * Principles:
 * 1. Cache DOM elements ONCE when mounted
 * 2. No timeouts - event driven
 * 3. No reactivity - pure DOM manipulation
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

  const elementCache = new Map<string, Element>()

  const refreshElementCache = () => {
    // Clear cache for removed nodes
    for (const [id] of elementCache) {
      if (!vueNodeData.value.has(id)) {
        elementCache.delete(id)
      }
    }

    // Add new nodes to cache
    for (const [id] of vueNodeData.value) {
      if (!elementCache.has(id)) {
        const element = document.querySelector(`[data-node-id="${id}"]`)
        if (element) {
          elementCache.set(id, element)
        }
      }
    }
  }

  /**
   * Update visibility - uses cached elements
   */
  const updateVisibility = () => {
    if (!nodeManager.value || !canvasStore.canvas || !comfyApp.canvas) return

    const canvas = canvasStore.canvas
    const manager = nodeManager.value
    const ds = canvas.ds

    // Viewport bounds
    const viewport_width = canvas.canvas.width
    const viewport_height = canvas.canvas.height
    const margin = 200 * ds.scale

    // Update visibility using cached elements
    elementCache.forEach((element, nodeId) => {
      const node = manager.getNode(nodeId)
      if (!node) {
        // Node deleted, remove from cache
        elementCache.delete(nodeId)
        return
      }

      // Calculate if in viewport
      const screen_x = (node.pos[0] + ds.offset[0]) * ds.scale
      const screen_y = (node.pos[1] + ds.offset[1]) * ds.scale
      const screen_width = node.size[0] * ds.scale
      const screen_height = node.size[1] * ds.scale

      const isVisible = !(
        screen_x + screen_width < -margin ||
        screen_x > viewport_width + margin ||
        screen_y + screen_height < -margin ||
        screen_y > viewport_height + margin
      )

      // Toggle visibility class
      if (isVisible) {
        element.classList.remove('node-hidden')
      } else {
        element.classList.add('node-hidden')
      }
    })
  }

  /**
   * Handle transform update - called by TransformPane event
   * @param detectChangesInRAF - Function to detect node position/size changes
   */
  const handleTransformUpdate = (detectChangesInRAF?: () => void) => {
    if (!isVueNodesEnabled.value) return

    // Detect node position/size changes if function provided
    if (detectChangesInRAF) {
      detectChangesInRAF()
    }

    // Refresh cache for any new/removed nodes
    refreshElementCache()

    // Update visibility culling
    updateVisibility()
  }

  return {
    allNodes,
    handleTransformUpdate,
    updateVisibility
  }
}
