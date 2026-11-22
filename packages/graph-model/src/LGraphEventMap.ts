import type {
  LGraph,
  LGraphNode,
  LLink,
  ResolvedConnection,
  Subgraph
} from './entityRegistry'

import type { SerializedNodeId } from './nodeId'

import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'

import type { NodeSlotType } from './globalEnums'
import type {
  ExportedSubgraph,
  ISerialisedGraph,
  SerialisableGraph
} from './serialisation'

export interface LGraphEventMap {
  configuring: {
    data: ISerialisedGraph | SerialisableGraph

    clearGraph: boolean
  }
  configured: never

  'subgraph-created': {
    subgraph: Subgraph

    data: ExportedSubgraph
  }

  'convert-to-subgraph': {
    subgraph: Subgraph

    bounds: ReadOnlyRect

    exportedSubgraph: ExportedSubgraph

    boundaryLinks: LLink[]

    resolvedInputLinks: ResolvedConnection[]

    resolvedOutputLinks: ResolvedConnection[]

    boundaryFloatingLinks: LLink[]

    internalLinks: LLink[]
  }

  'open-subgraph': {
    subgraph: Subgraph
    closingGraph: LGraph | Subgraph
  }

  'node:added': {
    node: LGraphNode
  }

  'node:before-removed': {
    node: LGraphNode
  }

  'node:removed': {
    node: LGraphNode
  }

  'node:property:changed': {
    nodeId: SerializedNodeId
    property: string
    oldValue: unknown
    newValue: unknown
  }
  'node:slot-label:changed': {
    nodeId: SerializedNodeId
    slotType?: NodeSlotType
  }
}

export type NodeLifecycleEvent = CustomEvent<
  LGraphEventMap['node:added' | 'node:removed']
>

export type NodeBeforeRemovedEvent = CustomEvent<
  LGraphEventMap['node:before-removed']
>
