/** Syncs widget control components and link state into the widget value store. */
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { promotedInputSource } from '@/core/graph/subgraph/promotedInputWidget'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isValueControlWidget } from './valueControl'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'

function findControlWidgets(target: IBaseWidget): {
  controlWidgetId?: WidgetId
  filterWidgetId?: WidgetId
} {
  const control = target.linkedWidgets?.find(isValueControlWidget)
  if (!control) return {}
  const filter = target.linkedWidgets?.find(
    (w) => w !== control && w.type === 'string'
  )
  return { controlWidgetId: control.widgetId, filterWidgetId: filter?.widgetId }
}

function syncControl(
  targetId: WidgetId | undefined,
  control: IBaseWidget,
  linked: boolean
): void {
  if (!targetId) return
  const store = useWidgetValueStore()
  const { controlWidgetId, filterWidgetId } = findControlWidgets(control)
  if (controlWidgetId) {
    store.registerWidgetControl(targetId, { controlWidgetId, filterWidgetId })
  } else {
    store.deleteWidgetControl(targetId)
  }
  store.setInputLinked(targetId, linked)
}

function syncPromotedControls(node: LGraphNode): void {
  if (!node.isSubgraphNode()) return
  const store = useWidgetValueStore()
  for (const input of node.inputs) {
    if (!input.widgetId) continue

    const source = promotedInputSource(node, input)
    const resolution = source
      ? resolveConcretePromotedWidget(node, source.nodeId, source.widgetName)
      : undefined
    if (resolution?.status !== 'resolved') {
      store.deleteWidgetControl(input.widgetId)
      store.setInputLinked(input.widgetId, input.link != null)
      continue
    }

    syncControl(input.widgetId, resolution.resolved.widget, input.link != null)
  }
}

function syncNodeControls(node: LGraphNode): void {
  if (node.isSubgraphNode()) {
    syncPromotedControls(node)
    return
  }
  for (const widget of node.widgets ?? []) {
    syncControl(
      widget.widgetId,
      widget,
      node.getSlotFromWidget(widget)?.link != null
    )
  }
}

function cleanupNodeControls(graph: LGraph, node: LGraphNode): void {
  const store = useWidgetValueStore()
  // node.graph is null once removal fires, so derive ids from the graph.
  const ids = node.isSubgraphNode()
    ? node.inputs.map((input) => input.widgetId)
    : (node.widgets ?? []).map((widget) =>
        widgetId(graph.rootGraph.id, node.id, widget.name)
      )
  for (const id of ids) {
    if (id) store.deleteWidgetControl(id)
  }
}

const hookedNodes = new WeakSet<LGraphNode>()
const originalConnectionsChange = new WeakMap<
  LGraphNode,
  LGraphNode['onConnectionsChange']
>()

function installNodeHooks(node: LGraphNode): void {
  syncNodeControls(node)
  if (hookedNodes.has(node)) return
  hookedNodes.add(node)

  originalConnectionsChange.set(node, node.onConnectionsChange)
  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (type) {
      if (type === NodeSlotType.INPUT) syncNodeControls(node)
    }
  )
}

function installNodeHooksRecursive(node: LGraphNode): void {
  installNodeHooks(node)
  if (node.isSubgraphNode?.()) {
    for (const innerNode of node.subgraph._nodes ?? []) {
      installNodeHooksRecursive(innerNode)
    }
  }
}

function restoreNodeHooks(node: LGraphNode): void {
  if (!hookedNodes.has(node)) return
  node.onConnectionsChange = originalConnectionsChange.get(node)
  originalConnectionsChange.delete(node)
  hookedNodes.delete(node)
}

function restoreNodeHooksRecursive(node: LGraphNode): void {
  restoreNodeHooks(node)
  if (node.isSubgraphNode?.()) {
    for (const innerNode of node.subgraph._nodes ?? []) {
      restoreNodeHooksRecursive(innerNode)
    }
  }
}

export function installWidgetControlHooks(graph: LGraph): () => void {
  for (const node of graph._nodes ?? []) {
    installNodeHooksRecursive(node)
  }

  const originalOnNodeAdded = graph.onNodeAdded
  graph.onNodeAdded = function (node: LGraphNode) {
    installNodeHooksRecursive(node)
    originalOnNodeAdded?.call(this, node)
  }

  const originalOnNodeRemoved = graph.onNodeRemoved
  graph.onNodeRemoved = function (node: LGraphNode) {
    cleanupNodeControls(graph, node)
    originalOnNodeRemoved?.call(this, node)
  }

  return () => {
    for (const node of graph._nodes ?? []) {
      restoreNodeHooksRecursive(node)
    }
    graph.onNodeAdded = originalOnNodeAdded || undefined
    graph.onNodeRemoved = originalOnNodeRemoved || undefined
  }
}
