import { parseProxyWidgets } from '@/core/schemas/proxyWidget'
import type { ProxyWidgetsProperty } from '@/core/schemas/proxyWidget'
import {
  isProxyWidget,
  isDisconnectedWidget
} from '@/core/graph/subgraph/proxyWidget'
import { t } from '@/i18n'
import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLitegraphService } from '@/services/litegraphService'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

type PartialNode = Pick<LGraphNode, 'title' | 'id' | 'type'>

export type WidgetItem = [PartialNode, IBaseWidget]

function getProxyWidgets(node: SubgraphNode) {
  return parseProxyWidgets(node.properties.proxyWidgets)
}
export function promoteWidget(
  node: PartialNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  for (const parent of parents) {
    const proxyWidgets = [
      ...getProxyWidgets(parent),
      widgetItemToProperty([node, widget])
    ]
    parent.properties.proxyWidgets = proxyWidgets
  }
  widget.promoted = true
}

export function demoteWidget(
  node: PartialNode,
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
  if (!subgraph) {
    useToastStore().add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('subgraphStore.promoteOutsideSubgraph'),
      life: 2000
    })
    return []
  }
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
export function tryToggleWidgetPromotion() {
  const canvas = useCanvasStore().getCanvas()
  const [x, y] = canvas.graph_mouse
  const node = canvas.graph?.getNodeOnPos(x, y, canvas.visible_nodes)
  if (!node) return
  const widget = node.getWidgetOnPos(x, y, true)
  const parents = getParentNodes()
  if (!parents.length || !widget) return
  const promotableParents = parents.filter(
    (s) => !getProxyWidgets(s).some(matchesPropertyItem([node, widget]))
  )
  if (promotableParents.length > 0)
    promoteWidget(node, widget, promotableParents)
  else demoteWidget(node, widget, parents)
}
const recommendedNodes = [
  'CLIPTextEncode',
  'LoadImage',
  'SaveImage',
  'PreviewImage'
]
const recommendedWidgetNames = ['seed']
export function isRecommendedWidget([node, widget]: WidgetItem) {
  return (
    !widget.computedDisabled &&
    (recommendedNodes.includes(node.type) ||
      recommendedWidgetNames.includes(widget.name))
  )
}

function nodeWidgets(n: LGraphNode): WidgetItem[] {
  return n.widgets?.map((w: IBaseWidget) => [n, w]) ?? []
}
export function promoteRecommendedWidgets(subgraphNode: SubgraphNode) {
  const { updatePreviews } = useLitegraphService()
  const interiorNodes = subgraphNode.subgraph.nodes
  for (const node of interiorNodes) {
    node.updateComputedDisabled()
    function checkWidgets() {
      updatePreviews(node)
      const widget = node.widgets?.find((w) => w.name.startsWith('$$'))
      if (!widget) return
      const pw = getProxyWidgets(subgraphNode)
      if (pw.some(matchesPropertyItem([node, widget]))) return
      promoteWidget(node, widget, [subgraphNode])
    }
    requestAnimationFrame(() => updatePreviews(node, checkWidgets))
  }
  const filteredWidgets: WidgetItem[] = interiorNodes
    .flatMap(nodeWidgets)
    .filter(isRecommendedWidget)
  const proxyWidgets: ProxyWidgetsProperty =
    filteredWidgets.map(widgetItemToProperty)
  subgraphNode.properties.proxyWidgets = proxyWidgets
  subgraphNode.computeSize(subgraphNode.size)
}

export function pruneDisconnected(subgraphNode: SubgraphNode) {
  subgraphNode.properties.proxyWidgets = subgraphNode.widgets
    .filter(isProxyWidget)
    .filter((w) => !isDisconnectedWidget(w))
    .map((w) => [w._overlay.nodeId, w._overlay.widgetName])
}
