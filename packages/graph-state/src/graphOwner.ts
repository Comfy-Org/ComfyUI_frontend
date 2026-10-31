import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { UUID } from '@comfyorg/graph-model/uuid'

/** The fields store helpers read from the graph or subgraph that owns a node. */
export interface OwnerGraph {
  readonly id: UUID
  readonly isRootGraph: boolean
  readonly rootGraph: { readonly id: UUID }
}

/** The fields store helpers read to locate a node's store records. */
export interface OwnedNode {
  readonly id: NodeId
  readonly graph: OwnerGraph | null
}
