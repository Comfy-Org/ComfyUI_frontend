import type { ISlotType } from '@comfyorg/graph-model/interfaces'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'
import type { RerouteId } from '@comfyorg/graph-model/rerouteId'
import type { OwningGraphId } from '@comfyorg/graph-model/graphScopeId'

export interface LinkTopology {
  readonly id: LinkId
  graphId: OwningGraphId
  /** Output node; UNASSIGNED_NODE_ID when the output end is floating. */
  originNodeId: NodeId
  originSlot: number
  /** Input node; UNASSIGNED_NODE_ID when the input end is floating. */
  targetNodeId: NodeId
  targetSlot: number
  type: ISlotType
  /** Terminal reroute of the segment chain, when the link routes through one. */
  parentId?: RerouteId
}

/**
 * A floating link is not yet a link: it is reroute-chain state kept alive so
 * the chain survives disconnection, with exactly one assigned endpoint. Link
 * queries never return floating topologies; only reroute-chain bookkeeping
 * and slot-drag interactions see them.
 */
export function isFloatingTopology(topology: LinkTopology): boolean {
  return (
    topology.originNodeId === UNASSIGNED_NODE_ID ||
    topology.targetNodeId === UNASSIGNED_NODE_ID
  )
}
