import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

type ResolvedPromotedWidget = {
  node: LGraphNode
  widget: IBaseWidget
}

function resolveWidgetByInputLink(
  node: LGraphNode,
  inputName: string
): ResolvedPromotedWidget | undefined {
  if (!node.isSubgraphNode?.()) return undefined

  const inputSlot = node.subgraph.inputNode.slots.find(
    (slot) => slot.name === inputName
  )
  if (!inputSlot) return undefined

  for (const linkId of inputSlot.linkIds) {
    const link = node.subgraph.getLink(linkId)
    if (!link) continue

    const { inputNode } = link.resolve(node.subgraph)
    if (!inputNode) continue

    const targetInput = inputNode.inputs.find((entry) => entry.link === linkId)
    if (!targetInput) continue

    const targetWidget = inputNode.getWidgetFromSlot(targetInput)
    if (!targetWidget) continue

    return {
      node: inputNode,
      widget: targetWidget
    }
  }

  return undefined
}

type PromotedWidgetResolutionFailure = {
  reason: 'invalid-host' | 'cycle' | 'missing-node' | 'missing-widget'
  currentHostId: string
  sourceNodeId: string
  sourceWidgetName: string
  availableWidgetNames?: string[]
}

type PromotedWidgetResolutionResult =
  | {
      resolved: ResolvedPromotedWidget
    }
  | {
      failure: PromotedWidgetResolutionFailure
    }

export function resolvePromotedWidgetAtHost(
  hostNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): ResolvedPromotedWidget | undefined {
  const node = hostNode.subgraph.getNodeById(nodeId)
  if (!node) return undefined

  const widget = node.widgets?.find(
    (entry: IBaseWidget) => entry.name === widgetName
  )
  if (widget) return { node, widget }

  return resolveWidgetByInputLink(node, widgetName)
}

export function resolvePromotedWidgetLookupTarget(
  hostNode: SubgraphNode,
  _graphId: string,
  nodeId: string,
  widgetName: string
): { nodeId: string; widgetName: string } {
  const visited = new Set<string>()
  let currentHost = hostNode
  let currentNodeId = nodeId
  let currentWidgetName = widgetName

  while (true) {
    const visitKey = `${currentHost.id}:${currentNodeId}:${currentWidgetName}`
    if (visited.has(visitKey)) {
      return { nodeId: currentNodeId, widgetName: currentWidgetName }
    }
    visited.add(visitKey)

    const resolved = resolvePromotedWidgetAtHost(
      currentHost,
      currentNodeId,
      currentWidgetName
    )
    if (!resolved)
      return { nodeId: currentNodeId, widgetName: currentWidgetName }
    if (!isPromotedWidgetView(resolved.widget)) {
      return {
        nodeId: String(resolved.node.id),
        widgetName: resolved.widget.name
      }
    }

    if (!resolved.widget.node?.isSubgraphNode?.()) {
      return {
        nodeId: resolved.widget.sourceNodeId,
        widgetName: resolved.widget.sourceWidgetName
      }
    }

    currentHost = resolved.widget.node
    currentNodeId = resolved.widget.sourceNodeId
    currentWidgetName = resolved.widget.sourceWidgetName
  }
}

export function resolveConcretePromotedWidget(
  hostNode: LGraphNode,
  _graphId: string,
  nodeId: string,
  widgetName: string
): PromotedWidgetResolutionResult {
  if (!hostNode.isSubgraphNode()) {
    return {
      failure: {
        reason: 'invalid-host',
        currentHostId: String(hostNode.id),
        sourceNodeId: nodeId,
        sourceWidgetName: widgetName
      }
    }
  }

  const visited = new Set<string>()
  let currentHost = hostNode
  let currentNodeId = nodeId
  let currentWidgetName = widgetName

  while (true) {
    const key = `${currentHost.id}:${currentNodeId}:${currentWidgetName}`
    if (visited.has(key)) {
      return {
        failure: {
          reason: 'cycle',
          currentHostId: String(currentHost.id),
          sourceNodeId: currentNodeId,
          sourceWidgetName: currentWidgetName
        }
      }
    }
    visited.add(key)

    const sourceNode = currentHost.subgraph.getNodeById(currentNodeId)
    if (!sourceNode) {
      return {
        failure: {
          reason: 'missing-node',
          currentHostId: String(currentHost.id),
          sourceNodeId: currentNodeId,
          sourceWidgetName: currentWidgetName
        }
      }
    }

    const sourceWidget = sourceNode.widgets?.find(
      (entry) => entry.name === currentWidgetName
    )
    const resolvedSource = sourceWidget
      ? { node: sourceNode, widget: sourceWidget }
      : resolveWidgetByInputLink(sourceNode, currentWidgetName)
    if (!resolvedSource) {
      return {
        failure: {
          reason: 'missing-widget',
          currentHostId: String(currentHost.id),
          sourceNodeId: currentNodeId,
          sourceWidgetName: currentWidgetName,
          availableWidgetNames: sourceNode.widgets?.map((entry) => entry.name)
        }
      }
    }

    const concreteSourceNode = resolvedSource.node
    const concreteSourceWidget = resolvedSource.widget

    if (!isPromotedWidgetView(concreteSourceWidget)) {
      return {
        resolved: {
          node: concreteSourceNode,
          widget: concreteSourceWidget
        }
      }
    }

    if (!concreteSourceWidget.node?.isSubgraphNode?.()) {
      return {
        failure: {
          reason: 'missing-node',
          currentHostId: String(currentHost.id),
          sourceNodeId: concreteSourceWidget.sourceNodeId,
          sourceWidgetName: concreteSourceWidget.sourceWidgetName
        }
      }
    }

    currentHost = concreteSourceWidget.node
    currentNodeId = concreteSourceWidget.sourceNodeId
    currentWidgetName = concreteSourceWidget.sourceWidgetName
  }
}
