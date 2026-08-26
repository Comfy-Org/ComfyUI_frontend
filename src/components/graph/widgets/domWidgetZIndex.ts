import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

export function createDomWidgetNodeOrder(
  nodes: readonly LGraphNode[]
): ReadonlyMap<LGraphNode, number> {
  const nodeOrder = new Map<LGraphNode, number>()
  nodes.forEach((node, index) => {
    if (!nodeOrder.has(node)) nodeOrder.set(node, index)
  })
  return nodeOrder
}

export function getDomWidgetZIndex(
  node: LGraphNode,
  currentGraph: LGraphNode['graph'] | undefined,
  nodeOrder?: ReadonlyMap<LGraphNode, number>
): number {
  if (!currentGraph) return node.order ?? -1

  const graphOrder = nodeOrder
    ? nodeOrder.get(node)
    : currentGraph.nodes.indexOf(node)
  if (graphOrder === undefined || graphOrder === -1) return node.order ?? -1

  return graphOrder
}
