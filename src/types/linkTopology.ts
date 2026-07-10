import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import type { RerouteId } from '@/types/rerouteId'

export interface LinkTopology {
  id: LinkId
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
