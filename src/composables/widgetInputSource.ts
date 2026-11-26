import { SUBGRAPH_INPUT_ID } from '@comfyorg/litegraph/constants'
import type { LGraphNode, SubgraphNode } from '@comfyorg/litegraph/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useApp } from '@/scripts/appInstance'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import {
  getNodeByState,
  resolveInputSourceNode
} from '@comfyorg/litegraph/utils/graphTraversalUtil'
import { isSubgraph } from '@/utils/typeGuardUtil'

function viewedSubgraphHost(
  node: LGraphNode,
  renderedNodeId: NodeId
): SubgraphNode | undefined {
  const rendered = useApp().canvas.graph?.getNodeById(renderedNodeId)
  if (rendered?.isSubgraphNode() && rendered.subgraph === node.graph)
    return rendered

  const graph = useCanvasStore().currentGraph
  if (!isSubgraph(graph) || graph !== node.graph) return undefined
  const { currentHost } = useSubgraphNavigationStore()
  const host = currentHost && getNodeByState(graph.rootGraph, currentHost)
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
