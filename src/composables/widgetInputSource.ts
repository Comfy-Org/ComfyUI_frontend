import { useSubgraphInputValuesStore } from '@/components/graph/subgraph/subgraphInputValuesStore'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import type { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import {
  getNodeByState,
  resolveInputSourceNode
} from '@/utils/graphTraversalUtil'

function viewedSubgraphHost(
  node: LGraphNode,
  renderedNodeId: NodeId
): SubgraphNode | undefined {
  const rendered = app.canvas.graph?.getNodeById(renderedNodeId)
  if (rendered?.isSubgraphNode() && rendered.subgraph === node.graph)
    return rendered

  const { graph, selected } = useSubgraphInputValuesStore()
  if (!graph || graph !== node.graph || !selected) return undefined
  const host = getNodeByState(graph.rootGraph, selected)
  return host?.isSubgraphNode() ? host : undefined
}

export function resolveWidgetInputSource(
  node: LGraphNode,
  slot: number,
  renderedNodeId: NodeId
): LGraphNode | undefined {
  return resolveInputSourceNode(
    node,
    slot,
    viewedSubgraphHost(node, renderedNodeId)
  )
}

export function isWidgetInputConnected(
  node: LGraphNode,
  slot: number,
  renderedNodeId: NodeId
): boolean {
  const link = node.getInputLink(slot)
  if (!link) return false
  if (link.origin_id !== SUBGRAPH_INPUT_ID) return true
  const host = viewedSubgraphHost(node, renderedNodeId)
  return host ? host.isInputConnected(link.origin_slot) : true
}
