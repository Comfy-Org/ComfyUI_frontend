import type { NodeId } from '@/types/nodeId'
import { asNodeId } from '@/types/nodeId'

import type { LGraphState } from './LGraph'

const MAX_NODE_ID = 100_000_000

export function nextFreeNodeId(
  usedNodeIds: Set<number>,
  state: LGraphState
): NodeId {
  while (true) {
    const next = state.lastNodeId + 1
    if (next > MAX_NODE_ID)
      throw new Error('LiteGraph: node ID space exhausted')

    state.lastNodeId = next
    if (!usedNodeIds.has(next)) {
      usedNodeIds.add(next)
      return asNodeId(next)
    }
  }
}
