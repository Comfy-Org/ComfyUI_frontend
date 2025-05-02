import type { ExportedSubgraph, ExposedWidget, Serialisable, SerialisableGraph } from "@/types/serialisation"

import { type BaseLGraph, LGraph } from "@/LGraph"

import { SubgraphInput } from "./SubgraphInput"
import { SubgraphInputNode } from "./SubgraphInputNode"
import { SubgraphOutput } from "./SubgraphOutput"
import { SubgraphOutputNode } from "./SubgraphOutputNode"

/** Internal; simplifies type definitions. */
export type GraphOrSubgraph = LGraph | Subgraph

/** A subgraph definition. */
export class Subgraph extends LGraph implements BaseLGraph, Serialisable<ExportedSubgraph> {
  /** The display name of the subgraph. */
  name: string

  readonly inputNode = new SubgraphInputNode(this)
  readonly outputNode = new SubgraphOutputNode(this)

  /** Ordered list of inputs to the subgraph itself. Similar to a reroute, with the input side in the graph, and the output side in the subgraph. */
  readonly inputs: SubgraphInput[]
  /** Ordered list of outputs from the subgraph itself. Similar to a reroute, with the input side in the subgraph, and the output side in the graph. */
  readonly outputs: SubgraphOutput[]
  /** A list of node widgets displayed in the parent graph, on the subgraph object. */
  readonly widgets: ExposedWidget[]

  override get rootGraph(): LGraph {
    return this.parents[0]
  }

  /** @inheritdoc */
  get pathToRootGraph(): readonly [LGraph, ...Subgraph[]] {
    return [...this.parents, this]
  }

  constructor(
    readonly parents: readonly [LGraph, ...Subgraph[]],
    data: ExportedSubgraph,
  ) {
    if (!parents.length) throw new Error("Subgraph must have at least one parent")

    const cloned = structuredClone(data)
    const { name, inputs, outputs, widgets } = cloned
    super()

    this.name = name
    this.inputs = inputs?.map(x => new SubgraphInput(x, this.inputNode)) ?? []
    this.outputs = outputs?.map(x => new SubgraphOutput(x, this.outputNode)) ?? []
    this.widgets = widgets ?? []

    this.configure(cloned)
  }

  override asSerialisable(): ExportedSubgraph & Required<Pick<SerialisableGraph, "nodes" | "groups" | "extra">> {
    return {
      id: this.id,
      version: LGraph.serialisedSchemaVersion,
      state: this.state,
      revision: this.revision,
      config: this.config,
      name: this.name,
      inputNode: this.inputNode.asSerialisable(),
      outputNode: this.outputNode.asSerialisable(),
      inputs: this.inputs.map(x => x.asSerialisable()),
      outputs: this.outputs.map(x => x.asSerialisable()),
      widgets: [...this.widgets],
      nodes: this.nodes.map(node => node.serialize()),
      groups: this.groups.map(group => group.serialize()),
      links: [...this.links.values()].map(x => x.asSerialisable()),
      extra: this.extra,
    }
  }
}
