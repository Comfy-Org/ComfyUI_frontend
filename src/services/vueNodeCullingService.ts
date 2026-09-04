import { shallowRef } from 'vue'

import type { NodeId } from '@/types/nodeId'

const excludedNodeTypeCounts = new Map<string, number>()
const excludedNodeCounts = new Map<NodeId, number>()
const cullingOptOutVersion = shallowRef(0)

function registerCullingOptOut<T>(counts: Map<T, number>, key: T): () => void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
  cullingOptOutVersion.value++

  let registered = true
  return () => {
    if (!registered) return
    registered = false

    const currentCount = counts.get(key) ?? 0
    if (currentCount <= 1) counts.delete(key)
    else counts.set(key, currentCount - 1)
    cullingOptOutVersion.value++
  }
}

export function registerNodeTypeCullingOptOut(nodeType: string): () => void {
  return registerCullingOptOut(excludedNodeTypeCounts, nodeType)
}

export function registerNodeCullingOptOut(nodeId: NodeId): () => void {
  return registerCullingOptOut(excludedNodeCounts, nodeId)
}

export function isNodeTypeExcludedFromCulling(nodeType: string): boolean {
  void cullingOptOutVersion.value
  return excludedNodeTypeCounts.has(nodeType)
}

export function isNodeExcludedFromCulling(
  nodeId: NodeId,
  nodeType?: string
): boolean {
  void cullingOptOutVersion.value
  return (
    excludedNodeCounts.has(nodeId) ||
    (nodeType !== undefined && excludedNodeTypeCounts.has(nodeType))
  )
}

/** Bumps on every registration change; watch it to re-evaluate exclusions. */
export function getCullingOptOutVersion(): number {
  return cullingOptOutVersion.value
}
