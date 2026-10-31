import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'

export function getDomWidgetZIndex(
  node: LGraphNode,
  currentGraph: LGraphNode['graph'] | undefined
): number {
  if (!currentGraph) return node.order

  const graphOrder = currentGraph.nodes.indexOf(node)
  if (graphOrder === -1) return node.order

  return graphOrder
}
