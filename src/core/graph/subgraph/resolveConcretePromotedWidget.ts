import type {
  PromotedWidgetExecutionSource,
  ResolvedPromotedWidget
} from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveSubgraphInputTarget } from '@/core/graph/subgraph/resolveSubgraphInputTarget'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'

import { hasPromotedWidgetTarget } from './hasPromotedWidgetTarget'

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

function isNodeActive(node: LGraphNode): boolean {
  return (
    node.mode !== LGraphEventMode.NEVER && node.mode !== LGraphEventMode.BYPASS
  )
}

export function resolveActivePromotedWidgetConsumers(
  hostNode: LGraphNode,
  inputName: string
): ResolvedPromotedWidget[] {
  if (!hostNode.isSubgraphNode()) return []

  const pending: {
    host: SubgraphNode
    inputName: string
    nodePath: NodeId[]
    visited: ReadonlySet<SubgraphInput>
  }[] = [{ host: hostNode, inputName, nodePath: [], visited: new Set() }]
  const consumers: ResolvedPromotedWidget[] = []

  for (const entry of pending) {
    const { host, inputName, nodePath, visited } = entry
    if (nodePath.length >= MAX_PROMOTED_WIDGET_CHAIN_DEPTH) continue
    const input = host.subgraph.inputNode.slots.find(
      (slot) => slot.name === inputName
    )
    if (!input || visited.has(input)) continue
    const nextVisited = new Set(visited).add(input)

    for (const linkId of input.linkIds) {
      const link = host.subgraph.getLink(linkId)
      if (!link) continue
      const { inputNode, input: targetInput } = link.resolve(host.subgraph)
      if (!inputNode || !targetInput || !isNodeActive(inputNode)) continue
      const nextPath = [...nodePath, inputNode.id]

      if (inputNode.isSubgraphNode()) {
        if (targetInput.widgetId) {
          pending.push({
            host: inputNode,
            inputName: targetInput.name,
            nodePath: nextPath,
            visited: nextVisited
          })
        }
        continue
      }

      const widget = inputNode.getWidgetFromSlot(targetInput)
      if (widget)
        consumers.push({ node: inputNode, nodePath: nextPath, widget })
    }
  }

  return consumers
}

export function buildPromotedWidgetExecutionSources(
  executionId: NodeExecutionId,
  consumers: readonly ResolvedPromotedWidget[]
): PromotedWidgetExecutionSource[] {
  return consumers.flatMap(({ nodePath, widget }) => {
    const sourceExecutionId = buildPromotedSourceExecutionId(
      executionId,
      nodePath
    )
    return sourceExecutionId
      ? [{ executionId: sourceExecutionId, widgetName: widget.name }]
      : []
  })
}

export function hasActivePromotedWidgetConsumer(
  hostNode: LGraphNode,
  inputName: string
): boolean {
  if (!hostNode.isSubgraphNode()) return false
  const input = hostNode.subgraph.inputNode.slots.find(
    (slot) => slot.name === inputName
  )
  if (!input) return false
  const root = { host: hostNode, input }

  return hasPromotedWidgetTarget(
    root,
    MAX_PROMOTED_WIDGET_CHAIN_DEPTH,
    ({ input }) => input,
    ({ host, input }) => {
      const nested: Array<typeof root> = []
      let hasWidget = false
      for (const linkId of input.linkIds) {
        const link = host.subgraph.getLink(linkId)
        if (!link) continue
        const { inputNode } = link.resolve(host.subgraph)
        if (!inputNode || !isNodeActive(inputNode)) continue
        const targetInput = inputNode.inputs.find(
          (entry) => entry.link === linkId
        )
        if (!targetInput) continue
        if (!inputNode.isSubgraphNode()) {
          hasWidget ||= Boolean(inputNode.getWidgetFromSlot(targetInput))
          continue
        }
        const nestedInput = inputNode.subgraph.inputNode.slots.find(
          (slot) => slot.name === targetInput.name
        )
        if (targetInput.widgetId && nestedInput) {
          nested.push({ host: inputNode, input: nestedInput })
        }
      }
      return { hasWidget, nested }
    }
  )
}

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
