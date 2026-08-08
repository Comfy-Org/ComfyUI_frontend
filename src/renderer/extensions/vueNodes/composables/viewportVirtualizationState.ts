import type { NodeId } from '@/types/nodeId'

const virtualizedNodeIds = new Set<NodeId>()

export function replaceViewportVirtualizedNodeIds(
  nodeIds: Iterable<NodeId>
): void {
  virtualizedNodeIds.clear()
  for (const nodeId of nodeIds) virtualizedNodeIds.add(nodeId)
}

export function isNodeViewportVirtualized(nodeId: NodeId): boolean {
  return virtualizedNodeIds.has(nodeId)
}

export function clearViewportVirtualizedNodeIds(): void {
  virtualizedNodeIds.clear()
}
