import type { ResolvedPromotedWidget } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

type PromotedWidgetResolutionFailure =
  | 'invalid-host'
  | 'cycle'
  | 'missing-node'
  | 'missing-widget'
  | 'max-depth-exceeded'

type PromotedWidgetResolutionResult =
  | { status: 'resolved'; resolved: ResolvedPromotedWidget }
  | { status: 'failure'; failure: PromotedWidgetResolutionFailure }

const MAX_PROMOTED_WIDGET_CHAIN_DEPTH = 100

function traversePromotedWidgetChain(
  hostNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): PromotedWidgetResolutionResult {
  const visitedByHost = new WeakMap<SubgraphNode, Set<string>>()
  let currentHost = hostNode
  let currentNodeId = nodeId
  let currentWidgetName = widgetName

  for (let depth = 0; depth < MAX_PROMOTED_WIDGET_CHAIN_DEPTH; depth++) {
    const key = `${currentNodeId}:${currentWidgetName}`
    const visited = visitedByHost.get(currentHost) ?? new Set<string>()
    if (visited.has(key)) {
      return { status: 'failure', failure: 'cycle' }
    }
    visited.add(key)
    visitedByHost.set(currentHost, visited)

    const sourceNode = currentHost.subgraph.getNodeById(currentNodeId)
    if (!sourceNode) {
      return { status: 'failure', failure: 'missing-node' }
    }

    const sourceWidget = findWidgetByIdentity(
      sourceNode.widgets,
      currentWidgetName
    )
    if (!sourceWidget) {
      return { status: 'failure', failure: 'missing-widget' }
    }

    if (!isPromotedWidgetView(sourceWidget)) {
      return {
        status: 'resolved',
        resolved: { node: sourceNode, widget: sourceWidget }
      }
    }

    if (!sourceWidget.node?.isSubgraphNode()) {
      return { status: 'failure', failure: 'missing-node' }
    }

    currentHost = sourceWidget.node
    currentNodeId = sourceWidget.sourceNodeId
    currentWidgetName = sourceWidget.sourceWidgetName
  }

  return { status: 'failure', failure: 'max-depth-exceeded' }
}

function findWidgetByIdentity(
  widgets: IBaseWidget[] | undefined,
  widgetName: string
): IBaseWidget | undefined {
  return widgets?.find((entry) => entry.name === widgetName)
}

export function resolvePromotedWidgetAtHost(
  hostNode: SubgraphNode,
  nodeId: string,
  widgetName: string
): ResolvedPromotedWidget | undefined {
  const node = hostNode.subgraph.getNodeById(nodeId)
  if (!node) return undefined

  const widget = findWidgetByIdentity(node.widgets, widgetName)
  if (!widget) return undefined

  return { node, widget }
}

export function resolveConcretePromotedWidget(
  hostNode: LGraphNode,
  nodeId: string,
  widgetName: string
): PromotedWidgetResolutionResult {
  if (!hostNode.isSubgraphNode()) {
    return { status: 'failure', failure: 'invalid-host' }
  }
  return traversePromotedWidgetChain(hostNode, nodeId, widgetName)
}

export function resolvePromotedWidgetSource(
  hostNode: LGraphNode,
  widget: IBaseWidget
): ResolvedPromotedWidget | undefined {
  if (!isPromotedWidgetView(widget)) return undefined
  if (!hostNode.isSubgraphNode()) return undefined

  const result = resolveConcretePromotedWidget(
    hostNode,
    widget.sourceNodeId,
    widget.sourceWidgetName
  )
  if (result.status === 'resolved') return result.resolved

  return undefined
}
