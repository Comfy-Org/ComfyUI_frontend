import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutSource, Point } from '@/renderer/core/layout/types'

export function useLayoutMutations(source: LayoutSource) {
  const moveNode = (
    rootGraphId: UUID,
    nodeId: NodeId,
    position: Point
  ): void => {
    const existing = layoutStore.getNodeLayout(rootGraphId, nodeId)
    if (!existing) return

    layoutStore.applyOperation({
      type: 'moveNode',
      graphId: rootGraphId,
      nodeId,
      position,
      timestamp: Date.now(),
      source
    })
  }

  function batchMoveNodes(
    rootGraphId: UUID,
    updates: Array<{ nodeId: NodeId; position: Point }>
  ): void {
    if (updates.length === 0) return

    const nodeBoundsUpdates = updates.flatMap(({ nodeId, position }) => {
      const existing = layoutStore.getNodeLayout(rootGraphId, nodeId)
      if (!existing) return []

      return [
        {
          nodeId,
          bounds: {
            x: position.x,
            y: position.y,
            width: existing.size.width,
            height: existing.size.height
          }
        }
      ]
    })

    if (nodeBoundsUpdates.length === 0) return
    layoutStore.batchUpdateNodeBounds(rootGraphId, nodeBoundsUpdates, {
      source
    })
  }

  const setNodeZIndex = (
    rootGraphId: UUID,
    nodeId: NodeId,
    zIndex: number
  ): void => {
    const existing = layoutStore.getNodeLayout(rootGraphId, nodeId)
    if (!existing) return

    layoutStore.applyOperation({
      type: 'setNodeZIndex',
      graphId: rootGraphId,
      nodeId,
      zIndex,
      timestamp: Date.now(),
      source
    })
  }

  const bringNodeToFront = (rootGraphId: UUID, nodeId: NodeId): void => {
    setNodeZIndex(rootGraphId, nodeId, layoutStore.allocateZIndex())
  }

  return {
    moveNode,
    batchMoveNodes,
    setNodeZIndex,
    bringNodeToFront
  }
}
