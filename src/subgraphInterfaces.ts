import type { LGraphNode } from "./LGraphNode"
import type {
  ExportedSubgraph,
  ExportedSubgraphInstance,
  ExposedWidget,
  SubgraphIO,
} from "./types/serialisation"
import type { UUID } from "./utils/uuid"

import { LGraph } from "@/LGraph"

/** A subgraph definition. */
export interface Subgraph extends LGraph {
  parent: LGraph | Subgraph

  /** The display name of the subgraph. */
  name: string
  /** Ordered list of inputs to the subgraph itself. Similar to a reroute, with the input side in the graph, and the output side in the subgraph. */
  inputs: SubgraphIO[]
  /** Ordered list of outputs from the subgraph itself. Similar to a reroute, with the input side in the subgraph, and the output side in the graph. */
  outputs: SubgraphIO[]
  /** A list of node widgets displayed in the parent graph, on the subgraph object. */
  widgets: ExposedWidget[]

  export(): ExportedSubgraph
}

/**
 * An instance of a {@link Subgraph}, displayed as a node on the containing (parent) graph.
 * @remarks
 */
export interface SubgraphInstance extends LGraphNode {
  /** The definition of this subgraph; how its nodes are configured, etc. */
  subgraphType: Subgraph

  /** The root-level containing graph */
  rootGraph: LGraph
  /** The (sub)graph that contains this subgraph instance. */
  parent: LGraph | Subgraph

  type: UUID

  export(): ExportedSubgraphInstance
}
