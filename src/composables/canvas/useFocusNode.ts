import { nextTick } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { Subgraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { useLitegraphService } from '@/services/litegraphService'

async function navigateToGraph(targetGraph: LGraph) {
  const canvasStore = useCanvasStore()
  const canvas = canvasStore.canvas
  if (!canvas) return

  if (canvas.graph !== targetGraph) {
    canvas.subgraph =
      !targetGraph.isRootGraph && targetGraph instanceof Subgraph
        ? targetGraph
        : undefined
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

  async function focusNode(nodeId: string) {
    if (!canvasStore.canvas) return

    const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)
    if (!graphNode?.graph) return

    await navigateToGraph(graphNode.graph as LGraph)
    canvasStore.canvas?.animateToBounds(graphNode.boundingRect)
  }

  async function enterSubgraph(nodeId: string) {
    if (!canvasStore.canvas) return

    const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)
    if (!graphNode?.graph) return

    await navigateToGraph(graphNode.graph as LGraph)
    useLitegraphService().fitView()
  }

  return {
    focusNode,
    enterSubgraph
  }
}
