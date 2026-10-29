import { shallowReactive } from 'vue'

import type { NodeId } from '@comfyorg/graph-model/nodeId'

const excludedNodeTypeCounts = shallowReactive(new Map<string, number>())
const excludedNodeCounts = shallowReactive(new Map<NodeId, number>())

function registerCullingOptOut<T>(counts: Map<T, number>, key: T): () => void {
  counts.set(key, (counts.get(key) ?? 0) + 1)

  let registered = true
  return () => {
    if (!registered) return
    registered = false

    const currentCount = counts.get(key) ?? 0
    if (currentCount <= 1) counts.delete(key)
    else counts.set(key, currentCount - 1)
  }
}

export function registerNodeTypeCullingOptOut(nodeType: string): () => void {
  return registerCullingOptOut(excludedNodeTypeCounts, nodeType)
}

export function registerNodeCullingOptOut(nodeId: NodeId): () => void {
  return registerCullingOptOut(excludedNodeCounts, nodeId)
}

export function isNodeTypeExcludedFromCulling(nodeType: string): boolean {
  return excludedNodeTypeCounts.has(nodeType)
}

export function isNodeExcludedFromCulling(
  nodeId: NodeId,
  nodeType?: string
): boolean {
  return (
    excludedNodeCounts.has(nodeId) ||
    (nodeType !== undefined && excludedNodeTypeCounts.has(nodeType))
  )
}

export function getCullingOptOuts() {
  return {
    nodeTypes: [...excludedNodeTypeCounts.keys()],
    nodeIds: [...excludedNodeCounts.keys()]
  }
}
