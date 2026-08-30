import { nextTick } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

async function navigateToGraph(targetGraph: LGraph) {
  const canvasStore = useCanvasStore()
  const canvas = canvasStore.canvas
  if (!canvas) return

  if (canvas.graph !== targetGraph) {
    canvas.subgraph = targetGraph.isRootGraph
      ? undefined
      : (targetGraph as Subgraph)
    canvas.setGraph(targetGraph)

    await nextTick()

    // Double RAF to wait for LiteGraph's internal canvas frame cycle
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )
  }
}

export function useFocusNode() {
  const canvasStore = useCanvasStore()

  /* Focus a graph node on the canvas, descending into its subgraph if needed. */
  async function focusGraphNode(graphNode: LGraphNode) {
    if (!canvasStore.canvas || !graphNode.graph) return

    await navigateToGraph(graphNode.graph as LGraph)
    canvasStore.canvas?.animateToBounds(graphNode.boundingRect)
  }

  /* Locate and focus a node on the canvas by its execution ID. */
  async function focusNode(
    nodeId: string,
    executionIdMap?: Map<string, LGraphNode>
  ) {
    if (!canvasStore.canvas) return

    const graphNode = executionIdMap
      ? executionIdMap.get(nodeId)
      : getNodeByExecutionId(app.rootGraph, nodeId)
    if (!graphNode) return

    await focusGraphNode(graphNode)
  }

  return {
    focusGraphNode,
    focusNode
  }
}
