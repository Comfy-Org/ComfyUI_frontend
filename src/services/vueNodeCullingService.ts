import { shallowReactive } from 'vue'

import type { NodeId } from '@comfyorg/graph-model/nodeId'

const excludedNodeCounts = shallowReactive(new Map<NodeId, number>())

/** Keeps a node rendered in full detail until the returned release is called. */
export function registerNodeCullingOptOut(nodeId: NodeId): () => void {
  excludedNodeCounts.set(nodeId, (excludedNodeCounts.get(nodeId) ?? 0) + 1)

  let registered = true
  return () => {
    if (!registered) return
    registered = false

    const count = excludedNodeCounts.get(nodeId) ?? 0
    if (count <= 1) excludedNodeCounts.delete(nodeId)
    else excludedNodeCounts.set(nodeId, count - 1)
  }
}

export function isNodeExcludedFromCulling(nodeId: NodeId): boolean {
  return excludedNodeCounts.has(nodeId)
}
