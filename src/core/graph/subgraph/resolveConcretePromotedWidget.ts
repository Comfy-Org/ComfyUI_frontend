import type { ResolvedPromotedWidget } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveSubgraphInputTarget } from '@/core/graph/subgraph/resolveSubgraphInputTarget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'

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
  nodeId: NodeId,
  widgetName: string
): PromotedWidgetResolutionResult {
  const visitedByHost = new WeakMap<SubgraphNode, Set<string>>()
  let currentHost = hostNode
  let currentNodeId = nodeId
  let currentWidgetName = widgetName
  const nodePath: NodeId[] = []

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
    nodePath.push(sourceNode.id)

    if (sourceNode.isSubgraphNode()) {
      const target = resolveSubgraphInputTarget(sourceNode, currentWidgetName)
      if (!target) {
        return { status: 'failure', failure: 'missing-widget' }
      }
      currentHost = sourceNode
      currentNodeId = target.nodeId
      currentWidgetName = target.widgetName
      continue
    }

    const sourceWidget = sourceNode.widgets?.find(
      (entry) => entry.name === currentWidgetName
    )
    if (!sourceWidget) {
      return { status: 'failure', failure: 'missing-widget' }
    }

    return {
      status: 'resolved',
      resolved: { node: sourceNode, nodePath, widget: sourceWidget }
    }
  }

  return { status: 'failure', failure: 'max-depth-exceeded' }
}

export function resolveConcretePromotedWidget(
  hostNode: LGraphNode,
  rawNodeId: SerializedNodeId,
  widgetName: string
): PromotedWidgetResolutionResult {
  if (!hostNode.isSubgraphNode()) {
    return { status: 'failure', failure: 'invalid-host' }
  }
  const nodeId = toNodeId(rawNodeId)
  return traversePromotedWidgetChain(hostNode, nodeId, widgetName)
}

export function buildPromotedSourceExecutionId(
  hostExecutionId: NodeExecutionId,
  nodePath: readonly NodeId[]
): NodeExecutionId | undefined {
  const hostNodeIds = hostExecutionId.split(':').map(toNodeId)
  return nodePath.length
    ? (createNodeExecutionId([...hostNodeIds, ...nodePath]) ?? undefined)
    : undefined
}
