import { watch } from 'vue'

import {
  provideNodeDragEndSource,
  provideNodeMoveSource
} from '@/platform/nodeApi/interaction'

import type { NodeMoveTarget } from '@/platform/nodeApi/interaction'

import { layoutStore } from './store/layoutStore'
import type { LayoutChange } from './types'

function movedPositions(change: LayoutChange) {
  const { operation, nodeIds } = change
  if (operation.type === 'moveNode') {
    return nodeIds.map((nodeId) => ({
      nodeId,
      position: operation.position
    }))
  }
  if (operation.type === 'batchUpdateBounds') {
    return nodeIds.map((nodeId) => {
      const bounds = operation.bounds[nodeId]
      return { nodeId, position: { x: bounds.x, y: bounds.y } }
    })
  }
  return []
}

export function installNodeMoveBridge(): void {
  provideNodeMoveSource((onMove) =>
    layoutStore.onChange((change: LayoutChange) => {
      for (const { nodeId, position } of movedPositions(change)) {
        onMove(
          { rootGraphId: change.operation.graphId, nodeId: String(nodeId) },
          position
        )
      }
    })
  )

  provideNodeDragEndSource((onDragEnd) => {
    const moved = new Map<string, Map<string, NodeMoveTarget>>()

    const stopCollecting = layoutStore.onChange((change: LayoutChange) => {
      if (!layoutStore.isDraggingVueNodes.value) return
      for (const { nodeId } of movedPositions(change)) {
        const rootGraphId = change.operation.graphId
        let nodes = moved.get(rootGraphId)
        if (!nodes) {
          nodes = new Map()
          moved.set(rootGraphId, nodes)
        }
        nodes.set(String(nodeId), { rootGraphId, nodeId: String(nodeId) })
      }
    })

    const stopWatching = watch(
      () => layoutStore.isDraggingVueNodes.value,
      (dragging, wasDragging) => {
        if (dragging || !wasDragging) return
        if (moved.size)
          onDragEnd([...moved.values()].flatMap((nodes) => [...nodes.values()]))
        moved.clear()
      }
    )

    return () => {
      stopCollecting()
      stopWatching()
    }
  })
}
