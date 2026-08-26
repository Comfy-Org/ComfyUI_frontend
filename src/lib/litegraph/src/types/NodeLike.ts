import type { SerializedNodeId } from '@/types/nodeId'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { SubgraphIO } from '@/lib/litegraph/src/types/serialisation'

export interface NodeLike {
  id: SerializedNodeId

  canConnectTo(
    node: NodeLike,
    toSlot: INodeInputSlot | SubgraphIO,
    fromSlot: INodeOutputSlot | SubgraphIO
  ): boolean
}
