import type { NodeId } from '@/types/nodeId'

let pending = false
let expectedRenderedNodeIds: ReadonlySet<NodeId> | null | undefined

export function beginVueNodeSlotSync(): void {
  pending = true
  expectedRenderedNodeIds = undefined
}

export function completeVueNodeSlotSync(): void {
  pending = false
}

export function isVueNodeSlotSyncPending(): boolean {
  return pending
}

export function setExpectedRenderedNodeIdsState(
  nodeIds: ReadonlySet<NodeId> | null
): void {
  expectedRenderedNodeIds = nodeIds === null ? null : new Set(nodeIds)
}

export function getExpectedRenderedNodeIds():
  | ReadonlySet<NodeId>
  | null
  | undefined {
  return expectedRenderedNodeIds
}
