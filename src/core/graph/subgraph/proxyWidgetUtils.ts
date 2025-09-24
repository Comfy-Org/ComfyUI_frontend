import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { parseProxyWidgets } from '@/schemas/proxyWidget'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

function pushWidgets(node: SubgraphNode, ...widgets: [string, string][]) {
  const pw = getProxyWidgets(node)
  pw.push(...widgets)
  node.properties.proxyWidgets = JSON.stringify(pw)
}
function getProxyWidgets(node: SubgraphNode) {
  return parseProxyWidgets(node.properties.proxyWidgets)
}

/**
 * Enables display of a widget on the parent subgraphNode
 * @param {{IBaseWidget}} widget - The widget to be promoted
 * @param {{LGraphNode}} node - the node which owns the widget
 */
export function promoteWidget(widget: IBaseWidget, node: LGraphNode) {
  const { navigationStack } = useSubgraphNavigationStore()
  const subgraph = navigationStack.at(-1)
  if (!subgraph) throw new Error("Can't promote widget when not in subgraph")
  const parentGraph = navigationStack.at(-2) ?? subgraph.rootGraph
  for (const onode of parentGraph.nodes) {
    if (onode.type === subgraph.id && onode.isSubgraphNode()) {
      pushWidgets(onode, [`${node.id}`, widget.name])
    }
  }
}
