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
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app as comfyApp } from '@/scripts/app'

type Bounds = [left: number, right: number, top: number, bottom: number]

function getNodeBounds(node: LGraphNode): Bounds {
  const [nodeLeft, nodeTop] = node.pos
  const nodeRight = nodeLeft + node.size[0]
  const nodeBottom = nodeTop + node.size[1]
  return [nodeLeft, nodeRight, nodeTop, nodeBottom]
}

function viewportEdges(
  canvas: NonNullable<ReturnType<typeof useCanvasStore>['canvas']>
): Bounds {
  const ds = canvas.ds
  const viewport_width = canvas.canvas.width
  const viewport_height = canvas.canvas.height
  const margin = 500 * ds.scale

  const [xOffset, yOffset] = ds.offset

  const leftEdge = -margin / ds.scale - xOffset
  const rightEdge = (viewport_width + margin) / ds.scale - xOffset
  const topEdge = -margin / ds.scale - yOffset
  const bottomEdge = (viewport_height + margin) / ds.scale - yOffset
  return [leftEdge, rightEdge, topEdge, bottomEdge]
}

function boundsIntersect(boxA: Bounds, boxB: Bounds): boolean {
  const [aLeft, aRight, aTop, aBottom] = boxA
  const [bLeft, bRight, bTop, bBottom] = boxB

  const leftOf = aRight < bLeft
  const rightOf = aLeft > bRight
  const above = aBottom < bTop
  const below = aTop > bBottom
  return leftOf || rightOf || above || below
}

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

    // Viewport bounds
    const viewportBounds = viewportEdges(canvas)

    // Get all node elements at once
    const nodeElements = document.querySelectorAll('[data-node-id]')

    // Update each element's visibility
    for (const element of nodeElements) {
      const nodeId = element.getAttribute('data-node-id')
      if (!nodeId) continue

      const node = manager.getNode(nodeId)
      if (!node) continue

      const nodeBounds = getNodeBounds(node)

      // Calculate if node is outside viewport
      const isNodeOutsideViewport = !boundsIntersect(nodeBounds, viewportBounds)

      const displayValue = isNodeOutsideViewport ? 'none' : ''

      // Setting display none directly avoid potential cascade resolution
      if (
        element instanceof HTMLElement &&
        element.style.display !== displayValue
      ) {
        element.style.display = displayValue
      }
    }
  }
  const handleTransformUpdate = useThrottleFn(updateVisibility, 100, true)

  return {
    allNodes,
    handleTransformUpdate
  }
}
