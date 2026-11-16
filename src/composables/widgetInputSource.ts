import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import type { LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { resolveInputSourceNode } from '@/utils/graphTraversalUtil'

function viewedSubgraphHost(
  node: LGraphNode,
  renderedNodeId: NodeId
): SubgraphNode | undefined {
  const graph = node.graph
  if (!graph || graph === graph.rootGraph) return undefined

  const rendered = app.canvas.graph?.getNodeById(renderedNodeId)
  if (rendered?.isSubgraphNode() && rendered.subgraph === graph) return rendered

  const { navigationStack } = useSubgraphNavigationStore()
  if (navigationStack.at(-1) !== graph) return undefined
  const parent = navigationStack.at(-2) ?? graph.rootGraph
  const instances = parent.nodes.filter(
    (candidate): candidate is SubgraphNode =>
      candidate.isSubgraphNode() && candidate.subgraph === graph
  )
  return instances.length === 1 ? instances[0] : undefined
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
