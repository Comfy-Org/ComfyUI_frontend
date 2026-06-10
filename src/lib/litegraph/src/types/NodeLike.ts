import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { SubgraphIO } from '@/lib/litegraph/src/types/serialisation'
import type { LinkEndpointNodeId } from '@/lib/litegraph/src/utils/nodeId'

export interface NodeLike {
  id: LinkEndpointNodeId

  canConnectTo(
    node: NodeLike,
    toSlot: INodeInputSlot | SubgraphIO,
    fromSlot: INodeOutputSlot | SubgraphIO
  ): boolean
}
