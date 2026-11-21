import { useEventListener } from '@vueuse/core'
import { watch } from 'vue'

import type { CanvasSource, NodeMove } from '@/platform/nodeApi/v4/canvasSource'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutChange } from '@/renderer/core/layout/types'

/** The graph on screen, the canvas, its node moves and drags, as the V4 node API reads them. */
export function useNodeApiCanvasSource(): CanvasSource {
  const canvasStore = useCanvasStore()

  function followDragEnds(ended: () => void): () => void {
    const stopFollowingVueNodes = watch(
      () => layoutStore.isDraggingVueNodes.value,
      (dragging) => {
        if (!dragging) ended()
      }
    )
    const stopFollowingCanvas = useEventListener(
      () => canvasStore.canvas?.canvas,
      'litegraph:dragging-items-changed',
      (event: CustomEvent<{ dragging: boolean }>) => {
        if (!event.detail.dragging) ended()
      }
    )
    return () => {
      stopFollowingVueNodes()
      stopFollowingCanvas()
    }
  }

  return {
    visibleGraph: () => canvasStore.currentGraph,
    canvas: () => canvasStore.canvas,
    followMoves: (moved) =>
      layoutStore.onChange((change) => {
        const moves = movesIn(change)
        if (moves.length) moved(change.operation.graphId, moves)
      }),
    followDragEnds
  }
}

function movesIn({ operation, sizeChangedNodeIds }: LayoutChange): NodeMove[] {
  if (operation.type === 'moveNode') {
    const { nodeId, position } = operation
    return [{ nodeId, x: position.x, y: position.y }]
  }
  if (operation.type !== 'batchUpdateBounds') return []
  const resized = new Set(sizeChangedNodeIds)
  return operation.nodeIds
    .filter((nodeId) => !resized.has(nodeId))
    .map((nodeId) => {
      const { x, y } = operation.bounds[nodeId]
      return { nodeId, x, y }
    })
}
