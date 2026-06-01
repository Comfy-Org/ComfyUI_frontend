import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LLink, ResolvedConnection } from '@/lib/litegraph/src/LLink'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type {
  ExportedSubgraph,
  ISerialisedGraph,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'

export interface LGraphEventMap {
  configuring: {
    /** The data that was used to configure the graph. */
    data: ISerialisedGraph | SerialisableGraph
    /** If `true`, the graph will be cleared prior to adding the configuration. */
    clearGraph: boolean
  }
  configured: never

  'subgraph-created': {
    /** The subgraph that was created. */
    subgraph: Subgraph
    /** The raw data that was used to create the subgraph. */
    data: ExportedSubgraph
  }

  /** Dispatched when a group of items are converted to a subgraph. */
  'convert-to-subgraph': {
    /** The type of subgraph to create. */
    subgraph: Subgraph
    /** The boundary around every item that was moved into the subgraph. */
    bounds: ReadOnlyRect
    /** The raw data that was used to create the subgraph. */
    exportedSubgraph: ExportedSubgraph
    /** The links that were used to create the subgraph. */
    boundaryLinks: LLink[]
    /** Links that go from outside the subgraph in, via an input on the subgraph node. */
    resolvedInputLinks: ResolvedConnection[]
    /** Links that go from inside the subgraph out, via an output on the subgraph node. */
    resolvedOutputLinks: ResolvedConnection[]
    /** The floating links that were used to create the subgraph. */
    boundaryFloatingLinks: LLink[]
    /** The internal links that were used to create the subgraph. */
    internalLinks: LLink[]
  }

  'open-subgraph': {
    subgraph: Subgraph
    closingGraph: LGraph | Subgraph
  }

  'node:property:changed': {
    nodeId: NodeId
    property: string
    oldValue: unknown
    newValue: unknown
  }
  'node:slot-errors:changed': { nodeId: NodeId }
  'node:slot-links:changed': {
    nodeId: NodeId
    slotType: NodeSlotType
    slotIndex: number
    connected: boolean
    linkId: number
  }
  'node:slot-label:changed': {
    nodeId: NodeId
    slotType?: NodeSlotType
  }
}
