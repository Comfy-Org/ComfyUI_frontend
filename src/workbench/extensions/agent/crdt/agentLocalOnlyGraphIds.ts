import { inputLinkId, outputLinkIds } from '@/lib/litegraph/src/node/slotLinks'
import { parseNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import type { MaterializableGraph } from './agentNodeMaterializer'
import type { LocalOnlyGraphIds } from './ecsFollowerAdapter'

function incidentLinkIds(graph: MaterializableGraph, id: NodeId): number[] {
  const node = graph._nodes_by_id[id]
  if (!node) return []
  const ids: number[] = []
  for (let slot = 0; slot < node.inputs.length; slot++) {
    const linkId = inputLinkId(graph, id, slot)
    if (linkId !== undefined) ids.push(linkId)
  }
  for (let slot = 0; slot < node.outputs.length; slot++) {
    ids.push(...outputLinkIds(graph, id, slot))
  }
  return ids
}

export function computeLocalOnlyGraphIds(
  graph: MaterializableGraph,
  everSeenIds: ReadonlySet<string>
): LocalOnlyGraphIds {
  const nodeIds = new Set(
    graph._nodes
      .map((node) => String(node.id))
      .filter((id) => !everSeenIds.has(id))
  )
  const linkIds = new Set<number>()
  for (const id of nodeIds) {
    const nodeId = parseNodeId(id)
    if (!nodeId) continue
    for (const linkId of incidentLinkIds(graph, nodeId)) linkIds.add(linkId)
  }
  return { nodeIds, linkIds }
}
