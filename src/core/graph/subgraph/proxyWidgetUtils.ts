import {
  type ProxyWidgetsProperty,
  parseProxyWidgets
} from '@/core/schemas/proxyWidget'
import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

export type WidgetItem = [LGraphNode, IBaseWidget]

function pushWidgets(node: SubgraphNode, ...widgets: [string, string][]) {
  const proxyWidgets = getProxyWidgets(node)
  proxyWidgets.push(...widgets)
  node.properties.proxyWidgets = proxyWidgets
}
function getProxyWidgets(node: SubgraphNode) {
  return parseProxyWidgets(node.properties.proxyWidgets)
}

/**
 * Enables display of a widget on the parent subgraphNode
 * @param {IBaseWidget} widget - The widget to be promoted
 * @param {LGraphNode} node - the node which owns the widget
 */
export function promoteWidget(
  node: LGraphNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  for (const parent of parents) pushWidgets(parent, [`${node.id}`, widget.name])
  widget.promoted = true
}

export function demoteWidget(
  node: LGraphNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  for (const parent of parents) {
    const proxyWidgets = getProxyWidgets(parent).filter(
      (widgetItem) => !matchesPropertyItem([node, widget])(widgetItem)
    )
    parent.properties.proxyWidgets = proxyWidgets
  }
  widget.promoted = false
}

export function matchesWidgetItem([nodeId, widgetName]: [string, string]) {
  return ([n, w]: WidgetItem) => n.id == nodeId && w.name === widgetName
}
export function matchesPropertyItem([n, w]: WidgetItem) {
  return ([nodeId, widgetName]: [string, string]) =>
    n.id == nodeId && w.name === widgetName
}
export function widgetItemToProperty([n, w]: WidgetItem): [string, string] {
  return [`${n.id}`, w.name]
}

function getParentNodes(): SubgraphNode[] {
  //NOTE: support for determining parents of a subgraph is limited
  //This function will require rework to properly support linked subgraphs
  //Either by including actual parents in the navigation stack,
  //or by adding a new event for parent listeners to collect from
  const { navigationStack } = useSubgraphNavigationStore()
  const subgraph = navigationStack.at(-1)
  if (!subgraph) throw new Error("Can't promote widget when not in subgraph")
  const parentGraph = navigationStack.at(-2) ?? subgraph.rootGraph
  return parentGraph.nodes.filter(
    (node): node is SubgraphNode =>
      node.type === subgraph.id && node.isSubgraphNode()
  )
}

export function addWidgetPromotionOptions(
  options: (IContextMenuValue<unknown> | null)[],
  widget: IBaseWidget,
  node: LGraphNode
) {
  const parents = getParentNodes()
  const promotableParents = parents.filter(
    (s) => !getProxyWidgets(s).some(matchesPropertyItem([node, widget]))
  )
  if (promotableParents.length > 0)
    options.unshift({
      content: `Promote Widget: ${widget.label ?? widget.name}`,
      callback: () => {
        promoteWidget(node, widget, promotableParents)
      }
    })
  else {
    options.unshift({
      content: `Un-Promote Widget: ${widget.label ?? widget.name}`,
      callback: () => {
        demoteWidget(node, widget, parents)
      }
    })
  }
}
//FIXME: This currently has ugly duplication with the sidebar pane
//Refactor all the computed widget logic into a separate file (composable?)
const recommendedNodes = [
  'CLIPTextEncode',
  'LoadImage',
  'SaveImage',
  'PreviewImage'
]
const recommendedWidgetNames = ['seed']
function nodeWidgets(n: LGraphNode): WidgetItem[] {
  return n.widgets?.map((w: IBaseWidget) => [n, w]) ?? []
}
export function promoteRecommendedWidgets(subgraphNode: SubgraphNode) {
  const interiorNodes = subgraphNode.subgraph.nodes
  const filteredWidgets: WidgetItem[] = interiorNodes
    .flatMap(nodeWidgets)
    //widget has connected link. Should not be eligible for promotion
    .filter(([_, w]: WidgetItem) => !w.computedDisabled)
    .filter(
      ([node, widget]: WidgetItem) =>
        recommendedNodes.includes(node.type) ||
        recommendedWidgetNames.includes(widget.name)
    )
  const proxyWidgets: ProxyWidgetsProperty =
    filteredWidgets.map(widgetItemToProperty)
  subgraphNode.properties.proxyWidgets = proxyWidgets
}
