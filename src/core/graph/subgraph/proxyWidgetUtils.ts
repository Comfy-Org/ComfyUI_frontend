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

type PartialNode = Pick<LGraphNode, 'title' | 'id' | 'type' | 'widgets'>

export type WidgetItem = [PartialNode, IBaseWidget]

function getProxyWidgets(node: SubgraphNode) {
  return parseProxyWidgets(node.properties.proxyWidgets)
}

/**
 * Find all child widgets of a dynamic combo parent by name.
 */
function getChildWidgets(
  node: PartialNode,
  parentWidgetName: string
): IBaseWidget[] {
  return (
    node.widgets?.filter((w) => w.dynamicWidgetParent === parentWidgetName) ??
    []
  )
}

/**
 * Check if a widget is a child of a dynamic combo root.
 */
export function isDynamicComboChild(
  node: LGraphNode,
  widgetName: string
): boolean {
  const widget = node.widgets?.find((w) => w.name === widgetName)
  if (widget) return !!widget.dynamicWidgetParent

  // Widget doesn't exist (disconnected) - parse name to find parent
  // because the widget doesnt exist, we dont have any concrete flag for if
  // this is a child of a dynamic combo, so we need to parse the name to find the parent
  const dotIndex = widgetName.indexOf('.')
  if (dotIndex === -1) return false
  const parentName = widgetName.slice(0, dotIndex)
  const parentWidget = node.widgets?.find((w) => w.name === parentName)
  return !!parentWidget?.dynamicWidgetRoot
}

/**
 * Check if a widget is a child of a promoted dynamic combo.
 */
function isChildOfPromotedDynamicCombo(
  node: LGraphNode,
  widget: IBaseWidget
): boolean {
  if (!widget.dynamicWidgetParent) return false
  const parentWidget = node.widgets?.find(
    (w) => w.name === widget.dynamicWidgetParent
  )
  return !!parentWidget?.promoted
}

/**
 * Get a widget and all its dynamic combo children (if it's a root).
 */
function getWidgetWithChildren(
  node: PartialNode,
  widget: IBaseWidget
): IBaseWidget[] {
  const widgets = [widget]
  if (widget.dynamicWidgetRoot && node.widgets) {
    widgets.push(...getChildWidgets(node, widget.name))
  }
  return widgets
}

/**
 * Batch promote multiple widgets to proxy on all parent SubgraphNodes.
 * Only adds widgets that don't already exist in proxyWidgets.
 */
function promoteWidgetsToProxy(
  node: PartialNode,
  widgets: IBaseWidget[],
  parents: SubgraphNode[]
) {
  for (const parent of parents) {
    const existing = getProxyWidgets(parent)
    const toAdd = widgets.filter(
      (w) => !existing.some(matchesPropertyItem([node, w]))
    )
    if (!toAdd.length) continue
    parent.properties.proxyWidgets = [
      ...existing,
      ...toAdd.map((w) => widgetItemToProperty([node, w]))
    ]
  }
  for (const w of widgets) {
    w.promoted = true
  }
}

export function promoteWidget(
  node: PartialNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  promoteWidgetsToProxy(node, getWidgetWithChildren(node, widget), parents)
}

export function demoteWidget(
  node: PartialNode,
  widget: IBaseWidget,
  parents: SubgraphNode[]
) {
  const widgetsToDemote = getWidgetWithChildren(node, widget)
  for (const parent of parents) {
    const proxyWidgets = getProxyWidgets(parent).filter(
      (widgetItem) =>
        !widgetsToDemote.some((w) => matchesPropertyItem([node, w])(widgetItem))
    )
    parent.properties.proxyWidgets = proxyWidgets
  }
  for (const w of widgetsToDemote) {
    w.promoted = false
  }
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

/**
 * Get all SubgraphNodes that contain the given node's graph.
 * Returns empty array if node is in root graph or graph is undefined.
 */
function getSubgraphParents(node: LGraphNode): SubgraphNode[] {
  const graph = node.graph
  if (!graph || graph.isRootGraph) return []

  return graph.rootGraph.nodes.filter(
    (n): n is SubgraphNode => n.type === graph.id && n.isSubgraphNode()
  )
}

/**
 * Mark proxy widgets pointing to this node as needing re-checking.
 * Called when a node's widgets change (e.g., dynamic combo value change).
 */
export function invalidateProxyWidgetsForNode(node: LGraphNode) {
  const parents = getSubgraphParents(node)
  const nodeId = `${node.id}`

  for (const parent of parents) {
    for (const widget of parent.widgets) {
      if (isProxyWidget(widget) && widget._overlay.nodeId === nodeId) {
        widget._overlay.needsResolve = true
      }
    }
  }
}

/**
 * Auto-promote child widgets of a dynamic combo when the parent is promoted.
 */
export function autoPromoteDynamicChildren(
  node: LGraphNode,
  parentWidget: IBaseWidget
) {
  const parents = getSubgraphParents(node)
  if (!parents.length) return

  // Check if the parent widget is actually promoted on any parent SubgraphNode.
  // This is more reliable than checking parentWidget.promoted, which may not
  // be set after workflow reload (the flag is only synced when navigating into
  // the subgraph).
  const nodeId = String(node.id)
  const promotedOnParents = parents.filter((parent) =>
    getProxyWidgets(parent).some(
      ([id, name]) => id === nodeId && name === parentWidget.name
    )
  )

  if (!promotedOnParents.length) return

  const childWidgets = getChildWidgets(node, parentWidget.name)
  promoteWidgetsToProxy(node, childWidgets, promotedOnParents)
}

/**
 * Get parent SubgraphNodes based on current navigation context.
 */
export function getParentNodes(): SubgraphNode[] {
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
    if (isChildOfPromotedDynamicCombo(node, widget)) return

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
  if (promotableParents.length > 0) {
    promoteWidget(node, widget, promotableParents)
  } else {
    if (isChildOfPromotedDynamicCombo(node, widget)) return
    demoteWidget(node, widget, parents)
  }
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
