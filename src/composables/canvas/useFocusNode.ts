import { nextTick } from 'vue'

import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

async function waitForAnimationFrame() {
  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(resolve, 100)
    requestAnimationFrame(() => {
      window.clearTimeout(timeoutId)
      resolve()
    })
  })
}

async function waitForCanvasNavigation() {
  await nextTick()

  // Double frame waits for LiteGraph's internal canvas cycle. The timeout
  // keeps focus calls from hanging while the document is backgrounded.
  await waitForAnimationFrame()
  await waitForAnimationFrame()
}

export function useFocusNode() {
  const canvasStore = useCanvasStore()
  const navigationStore = useSubgraphNavigationStore()

  async function focusNodeInstance(node: LGraphNode) {
    const canvas = canvasStore.canvas
    if (!canvas || !node.graph) return

    const graphChanged = canvas.graph !== node.graph
    const navigated = await navigationStore.navigateToGraph(node.graph)
    if (!navigated) return
    if (graphChanged) await waitForCanvasNavigation()

    const activeCanvas = canvasStore.canvas
    if (
      !activeCanvas ||
      activeCanvas.graph !== node.graph ||
      !node.graph.nodes.includes(node)
    ) {
      return
    }
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
