import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import {
  type ProxyWidgetsProperty,
  parseProxyWidgets
} from '@/schemas/proxyWidget'
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
 * @param {IBaseWidget} widget - The widget to be promoted
 * @param {LGraphNode} node - the node which owns the widget
 */
function promoteWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  parents: SubgraphNode[]
) {
  for (const parent of parents) pushWidgets(parent, [`${node.id}`, widget.name])
  widget.promoted = true
}

function demoteWidget(
  widget: IBaseWidget,
  node: LGraphNode,
  parents: SubgraphNode[]
) {
  for (const parent of parents) {
    const pw = getProxyWidgets(parent).filter(
      ([id, name]) => node.id != id || widget.name !== name
    )
    parent.properties.proxyWidgets = JSON.stringify(pw)
  }
  widget.promoted = false
}

function getParentNodes(): SubgraphNode[] {
  //NOTE: support for determining parents of a subgraph is limited
  //This function will require rework to properly support linked subgraphs
  //Either by including actual parents in the navigation stack,
  //or by adding a new event for parent listeners to collect from
  const { navigationStack } = useSubgraphNavigationStore()
  const subgraph = navigationStack.at(-1)
  if (!subgraph) throw new Error("Can't promote widget when not in subgraph")
  const validNodes = []
  const parentGraph = navigationStack.at(-2) ?? subgraph.rootGraph
  for (const onode of parentGraph.nodes) {
    if (onode.type === subgraph.id && onode.isSubgraphNode()) {
      validNodes.push(onode)
    }
  }
  return validNodes
}

export function addWidgetPromotionOptions(
  options: (IContextMenuValue<unknown> | null)[],
  widget: IBaseWidget,
  node: LGraphNode
) {
  const parents = getParentNodes()
  const promotableParents = parents.filter(
    (s) =>
      !getProxyWidgets(s).some(
        ([id, name]) => node.id == id && widget.name === name
      )
  )
  if (promotableParents.length > 0)
    options.unshift({
      content: `Promote Widget: ${widget.label ?? widget.name}`,
      callback: () => {
        promoteWidget(widget, node, promotableParents)
      }
    })
  else {
    options.unshift({
      content: `Un-Promote Widget: ${widget.label ?? widget.name}`,
      callback: () => {
        demoteWidget(widget, node, parents)
      }
    })
  }
}
//FIXME: This currently has ugly duplication with the sidebar pane
//Refactor all the computed widget logic into a separate file (composable?)
type WidgetItem = [LGraphNode, IBaseWidget]
const recommendedNodes = [
  'CLIPTextEncode',
  'LoadImage',
  'SaveImage',
  'PreviewImage'
]
const recommendedWidgetNames = ['seed']
function nodeWidgets(n: LGraphNode): WidgetItem[] {
  if (!n.widgets) return []
  return n.widgets.map((w: IBaseWidget) => [n, w])
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
  const pw: ProxyWidgetsProperty = filteredWidgets.map(([n, w]: WidgetItem) => [
    `${n.id}`,
    w.name
  ])
  subgraphNode.properties.proxyWidgets = JSON.stringify(pw)
}
