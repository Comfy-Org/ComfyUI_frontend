import { nextTick } from 'vue'

import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

async function waitForCanvasNavigation() {
  await nextTick()

  // Double RAF to wait for LiteGraph's internal canvas frame cycle
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )
}

export function useFocusNode() {
  const canvasStore = useCanvasStore()
  const navigationStore = useSubgraphNavigationStore()

  async function focusNodeInstance(node: LGraphNode) {
    if (!node.graph) return

    const navigated = await navigationStore.navigateToGraph(node.graph)
    if (!navigated) return
    await waitForCanvasNavigation()

    const activeCanvas = canvasStore.canvas
    if (!activeCanvas || activeCanvas.graph !== node.graph) return
    activeCanvas.animateToBounds(node.boundingRect, {
      viewport: visibleCanvasViewport(activeCanvas)
    })
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
    if (!graphNode?.graph) return

    await focusNodeInstance(graphNode)
  }

  return {
    focusNode,
    focusNodeInstance
  }
}
