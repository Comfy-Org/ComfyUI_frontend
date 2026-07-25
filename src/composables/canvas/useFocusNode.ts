import { nextTick } from 'vue'

import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/platform/agent/stores/agentPanelStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
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

/**
 * The region of the canvas that's actually visible, excluding the width
 * covered by the agent panel overlay. Centering on this instead of the full
 * canvas avoids landing nodes behind the panel when it's open.
 */
function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
  const agentPanelStore = useAgentPanelStore()
  const cw = canvas.canvas.width / window.devicePixelRatio
  const ch = canvas.canvas.height / window.devicePixelRatio
  const coveredWidth = agentPanelStore.isOpen ? agentPanelStore.width : 0
  return [0, 0, Math.max(cw - coveredWidth, 0), ch]
}

export function useFocusNode() {
  const canvasStore = useCanvasStore()

  /* Focus a known node instance, navigating to its owning graph first. */
  async function focusNodeInstance(node: LGraphNode) {
    const canvas = canvasStore.canvas
    if (!canvas || !node.graph) return

    await navigateToGraph(node.graph as LGraph)
    canvas.animateToBounds(node.boundingRect, {
      viewport: visibleCanvasViewport(canvas)
    })
  }

  /* Locate and focus a node on the canvas by its execution ID. */
  async function focusNode(
    nodeId: string,
    executionIdMap?: Map<string, LGraphNode>
  ) {
    const graphNode = executionIdMap
      ? executionIdMap.get(nodeId)
      : getNodeByExecutionId(app.rootGraph, nodeId)
    if (!graphNode) return

    await focusNodeInstance(graphNode)
  }

  return {
    focusNode,
    focusNodeInstance
  }
}
