import type { NodeId } from './nodeId'

export interface NodeBindable {
  setNodeId(nodeId: NodeId): void
}
