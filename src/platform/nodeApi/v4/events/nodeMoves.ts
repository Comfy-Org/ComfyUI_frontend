import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import type { CanvasSource } from '@/platform/nodeApi/v4/canvasSource'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  NodeHandle,
  NodeMoveEvent,
  Unsubscribe
} from '@/platform/nodeApi/v4/types'

export function createNodeMoves(
  nodes: NodeHandles,
  source: () => CanvasSource | undefined
): {
  onNodeMoved(listener: (event: NodeMoveEvent) => void): Unsubscribe
  onNodeDragEnd(listener: () => void): Unsubscribe
} {
  function nodeIn(
    visible: LGraph,
    rootGraphId: string,
    nodeId: NodeId
  ): NodeHandle | undefined {
    const { rootGraph } = visible
    if (rootGraph.id !== rootGraphId) return undefined
    for (const graph of [visible, rootGraph, ...rootGraph.subgraphs.values()]) {
      const node = nodes.find(graph, String(nodeId))
      if (node) return node
    }
    return undefined
  }

  return {
    onNodeMoved: createHostEvent<[NodeMoveEvent]>('onNodeMoved', (emit) => {
      const canvas = source()
      if (!canvas) return () => {}
      return canvas.followMoves((rootGraphId, moves) => {
        const visible = canvas.visibleGraph()
        if (!visible) return
        for (const { nodeId, x, y } of moves) {
          const node = nodeIn(visible, rootGraphId, nodeId)
          if (!node) continue
          emit(Object.freeze({ node, position: Object.freeze({ x, y }) }))
        }
      })
    }),
    onNodeDragEnd: createHostEvent('onNodeDragEnd', (emit) => {
      const canvas = source()
      return canvas ? canvas.followDragEnds(emit) : () => {}
    })
  }
}
