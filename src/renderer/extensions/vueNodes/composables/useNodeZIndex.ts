/**
 * Node Z-Index Management Composable
 *
 * Provides focused functionality for managing node layering through z-index.
 * Integrates with the layout system to ensure proper visual ordering.
 */
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@comfyorg/graph-state/layout/layoutMutations'
import { LayoutSource } from '@comfyorg/graph-state/layout/types'

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
