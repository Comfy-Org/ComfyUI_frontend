/**
 * Node Z-Index Management Composable
 *
 * Provides focused functionality for managing node layering through z-index.
 * Integrates with the layout system to ensure proper visual ordering.
 */
import type { NodeId } from '@/types/nodeId'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

export function useNodeZIndex() {
  const layoutMutations = useLayoutMutations(LayoutSource.Vue)
  const canvasStore = useCanvasStore()

  function bringNodeToFront(nodeId: NodeId) {
    const { currentGraph } = canvasStore
    if (!currentGraph) return

    layoutMutations.setNodeOrder(currentGraph, nodeId, 'front')
  }

  return {
    bringNodeToFront
  }
}
