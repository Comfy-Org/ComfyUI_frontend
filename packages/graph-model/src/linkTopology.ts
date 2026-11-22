import type { ISlotType } from './interfaces'
import type { LinkId } from './linkId'
import type { NodeId } from './nodeId'
import { UNASSIGNED_NODE_ID } from './nodeId'
import type { RerouteId } from './rerouteId'
import type { OwningGraphId } from './graphScopeId'

export interface LinkTopology {
  readonly id: LinkId
  graphId: OwningGraphId

  originNodeId: NodeId
  originSlot: number

  targetNodeId: NodeId
  targetSlot: number
  type: ISlotType

  parentId?: RerouteId
}

export function isFloatingTopology(topology: LinkTopology): boolean {
  return (
    topology.originNodeId === UNASSIGNED_NODE_ID ||
    topology.targetNodeId === UNASSIGNED_NODE_ID
  )
}
