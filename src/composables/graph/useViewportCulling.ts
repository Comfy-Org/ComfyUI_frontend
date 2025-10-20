/**
 * Vue Nodes Viewport Culling
 *
 * Principles:
 * 1. Query DOM directly using data attributes (no cache to maintain)
 * 2. Set display none on element to avoid cascade resolution overhead
 * 3. Only run when transform changes (event driven)
 */
import { createSharedComposable, useThrottleFn } from '@vueuse/core'
import { computed } from 'vue'

import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

type Bounds = [left: number, right: number, top: number, bottom: number]

function getNodeBounds(node: LGraphNode): Bounds {
  const [nodeLeft, nodeTop] = node.pos
  const nodeRight = nodeLeft + node.size[0]
  const nodeBottom = nodeTop + node.size[1]
  return [nodeLeft, nodeRight, nodeTop, nodeBottom]
}

function viewportEdges(
  canvas: ReturnType<typeof useCanvasStore>['canvas']
): Bounds | undefined {
  if (!canvas) {
    return
  }
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
  return !(leftOf || rightOf || above || below)
}

function useViewportCullingIndividual() {
  const canvasStore = useCanvasStore()
  const { nodeManager } = useVueNodeLifecycle()

  const viewport = computed(() => viewportEdges(canvasStore.canvas))

  function inViewport(node: LGraphNode | undefined): boolean {
    if (!viewport.value || !node) {
      return true
    }
    const nodeBounds = getNodeBounds(node)
    return boundsIntersect(nodeBounds, viewport.value)
  }

  /**
   * Update visibility of all nodes based on viewport
   * Queries DOM directly - no cache maintenance needed
   */
  function updateVisibility() {
    if (!nodeManager.value || !app.canvas) return // load bearing app.canvas check for workflows being loaded.

    const nodeElements = document.querySelectorAll('[data-node-id]')
    for (const element of nodeElements) {
      const nodeId = element.getAttribute('data-node-id')
      if (!nodeId) continue

      const node = nodeManager.value.getNode(nodeId)
      if (!node) continue

      const displayValue = inViewport(node) ? '' : 'none'
      if (
        element instanceof HTMLElement &&
        element.style.display !== displayValue
      ) {
        element.style.display = displayValue
      }
    }
  }

  const handleTransformUpdate = useThrottleFn(() => updateVisibility, 100, true)

  return { handleTransformUpdate }
}

export const useViewportCulling = createSharedComposable(
  useViewportCullingIndividual
)
