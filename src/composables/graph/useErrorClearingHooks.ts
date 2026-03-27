/**
 * Installs per-node error-clearing callbacks (onConnectionsChange,
 * onWidgetChanged) on all current and future nodes in a graph.
 *
 * Decoupled from the Vue rendering lifecycle so that error auto-clearing
 * works in legacy canvas mode as well.
 */
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'

function resolvePromotedExecId(
  rootGraph: LGraph,
  node: LGraphNode,
  widget: IBaseWidget,
  hostExecId: string
): string {
  if (!isPromotedWidgetView(widget)) return hostExecId
  const result = resolveConcretePromotedWidget(
    node,
    widget.sourceNodeId,
    widget.sourceWidgetName
  )
  if (result.status === 'resolved' && result.resolved.node) {
    return getExecutionIdByNode(rootGraph, result.resolved.node) ?? hostExecId
  }
  return hostExecId
}

const hookedNodes = new WeakSet<LGraphNode>()

type OriginalCallbacks = {
  onConnectionsChange: LGraphNode['onConnectionsChange']
  onWidgetChanged: LGraphNode['onWidgetChanged']
}

const originalCallbacks = new WeakMap<LGraphNode, OriginalCallbacks>()

function installNodeHooks(node: LGraphNode): void {
  if (hookedNodes.has(node)) return
  hookedNodes.add(node)

  originalCallbacks.set(node, {
    onConnectionsChange: node.onConnectionsChange,
    onWidgetChanged: node.onWidgetChanged
  })

  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (type, slotIndex, isConnected) {
      if (type !== NodeSlotType.INPUT || !isConnected) return
      if (!app.rootGraph) return
      const slotName = node.inputs?.[slotIndex]?.name
      if (!slotName) return
      const execId = getExecutionIdByNode(app.rootGraph, node)
      if (!execId) return
      useExecutionErrorStore().clearSimpleNodeErrors(execId, slotName)
    }
  )

  node.onWidgetChanged = useChainCallback(
    node.onWidgetChanged,
    // _name is the LiteGraph callback arg; re-derive from the widget
    // object to handle promoted widgets where sourceWidgetName differs.
    function (_name, newValue, _oldValue, widget) {
      if (!app.rootGraph) return
      const hostExecId = getExecutionIdByNode(app.rootGraph, node)
      if (!hostExecId) return

      const execId = resolvePromotedExecId(
        app.rootGraph,
        node,
        widget,
        hostExecId
      )
      const widgetName = isPromotedWidgetView(widget)
        ? widget.sourceWidgetName
        : widget.name

      useExecutionErrorStore().clearWidgetRelatedErrors(
        execId,
        widget.name,
        widgetName,
        newValue,
        { min: widget.options?.min, max: widget.options?.max }
      )
    }
  )
}

function restoreNodeHooks(node: LGraphNode): void {
  const originals = originalCallbacks.get(node)
  if (!originals) return
  node.onConnectionsChange = originals.onConnectionsChange
  node.onWidgetChanged = originals.onWidgetChanged
  originalCallbacks.delete(node)
  hookedNodes.delete(node)
}

function installNodeHooksRecursive(node: LGraphNode): void {
  installNodeHooks(node)
  if (node.isSubgraphNode?.()) {
    for (const innerNode of node.subgraph._nodes ?? []) {
      installNodeHooksRecursive(innerNode)
    }
  }
}

function restoreNodeHooksRecursive(node: LGraphNode): void {
  restoreNodeHooks(node)
  if (node.isSubgraphNode?.()) {
    for (const innerNode of node.subgraph._nodes ?? []) {
      restoreNodeHooksRecursive(innerNode)
    }
  }
}

export function installErrorClearingHooks(graph: LGraph): () => void {
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
    restoreNodeHooksRecursive(node)
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
