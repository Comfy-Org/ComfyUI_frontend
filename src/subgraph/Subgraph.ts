import type { DefaultConnectionColors } from "@/interfaces"
import type { LGraphCanvas } from "@/LGraphCanvas"
import type { ExportedSubgraph, ExposedWidget, ISerialisedGraph, Serialisable, SerialisableGraph } from "@/types/serialisation"

import { type BaseLGraph, LGraph } from "@/LGraph"
import { createUuidv4, type LGraphNode } from "@/litegraph"

import { SubgraphInput } from "./SubgraphInput"
import { SubgraphInputNode } from "./SubgraphInputNode"
import { SubgraphOutput } from "./SubgraphOutput"
import { SubgraphOutputNode } from "./SubgraphOutputNode"

/** Internal; simplifies type definitions. */
export type GraphOrSubgraph = LGraph | Subgraph

/** A subgraph definition. */
export class Subgraph extends LGraph implements BaseLGraph, Serialisable<ExportedSubgraph> {
  /** Limits the number of levels / depth that subgraphs may be nested.  Prevents uncontrolled programmatic nesting. */
  static MAX_NESTED_SUBGRAPHS = 1000

  /** The display name of the subgraph. */
  name: string = "Unnamed Subgraph"

  readonly inputNode = new SubgraphInputNode(this)
  readonly outputNode = new SubgraphOutputNode(this)

  /** Ordered list of inputs to the subgraph itself. Similar to a reroute, with the input side in the graph, and the output side in the subgraph. */
  readonly inputs: SubgraphInput[] = []
  /** Ordered list of outputs from the subgraph itself. Similar to a reroute, with the input side in the subgraph, and the output side in the graph. */
  readonly outputs: SubgraphOutput[] = []
  /** A list of node widgets displayed in the parent graph, on the subgraph object. */
  readonly widgets: ExposedWidget[] = []

  #rootGraph: LGraph
  override get rootGraph(): LGraph {
    return this.#rootGraph
  }

  constructor(
    rootGraph: LGraph,
    data: ExportedSubgraph,
  ) {
    if (!rootGraph) throw new Error("Root graph is required")

    super()

    this.#rootGraph = rootGraph

    const cloned = structuredClone(data)
    this._configureBase(cloned)
    this.#configureSubgraph(cloned)
  }

  getIoNodeOnPos(x: number, y: number): SubgraphInputNode | SubgraphOutputNode | undefined {
    const { inputNode, outputNode } = this
    if (inputNode.containsPoint([x, y])) return inputNode
    if (outputNode.containsPoint([x, y])) return outputNode
  }

  #configureSubgraph(data: ISerialisedGraph & ExportedSubgraph | SerialisableGraph & ExportedSubgraph): void {
    const { name, inputs, outputs, widgets } = data

    this.name = name
    if (inputs) {
      this.inputs.length = 0
      for (const input of inputs) {
        this.inputs.push(new SubgraphInput(input, this.inputNode))
      }
    }

    if (outputs) {
      this.outputs.length = 0
      for (const output of outputs) {
        this.outputs.push(new SubgraphOutput(output, this.outputNode))
      }
    }

    if (widgets) {
      this.widgets.length = 0
      for (const widget of widgets) {
        this.widgets.push(widget)
      }
    }

    this.inputNode.configure(data.inputNode)
    this.outputNode.configure(data.outputNode)
  }

  override configure(data: ISerialisedGraph & ExportedSubgraph | SerialisableGraph & ExportedSubgraph, keep_old?: boolean): boolean | undefined {
    const r = super.configure(data, keep_old)

    this.#configureSubgraph(data)
    return r
  }

  override attachCanvas(canvas: LGraphCanvas): void {
    super.attachCanvas(canvas)
    canvas.subgraph = this
  }

  addInput(name: string, type: string): SubgraphInput {
    const input = new SubgraphInput({
      id: createUuidv4(),
      name,
      type,
    }, this.inputNode)

    this.inputs.push(input)

    const subgraphId = this.id
    this.#forAllNodes((node) => {
      if (node.type === subgraphId) {
        node.addInput(name, type)
      }
    })

    return input
  }

  addOutput(name: string, type: string): SubgraphOutput {
    const output = new SubgraphOutput({
      id: createUuidv4(),
      name,
      type,
    }, this.outputNode)

    this.outputs.push(output)

    const subgraphId = this.id
    this.#forAllNodes((node) => {
      if (node.type === subgraphId) {
        node.addOutput(name, type)
      }
    })

    return output
  }

  #forAllNodes(callback: (node: LGraphNode) => void): void {
    forNodes(this.rootGraph.nodes)
    for (const subgraph of this.rootGraph.subgraphs.values()) {
      forNodes(subgraph.nodes)
    }

    function forNodes(nodes: LGraphNode[]) {
      for (const node of nodes) {
        callback(node)
      }
    }
  }

  /**
   * Renames an input slot in the subgraph.
   * @param input The input slot to rename.
   * @param name The new name for the input slot.
   */
  renameInput(input: SubgraphInput, name: string): void {
    input.label = name
    const index = this.inputs.indexOf(input)
    if (index === -1) throw new Error("Input not found")

    this.#forAllNodes((node) => {
      if (node.type === this.id) {
        node.inputs[index].label = name
      }
    })
  }

  /**
   * Renames an output slot in the subgraph.
   * @param output The output slot to rename.
   * @param name The new name for the output slot.
   */
  renameOutput(output: SubgraphOutput, name: string): void {
    output.label = name
    const index = this.outputs.indexOf(output)
    if (index === -1) throw new Error("Output not found")

    this.#forAllNodes((node) => {
      if (node.type === this.id) {
        node.outputs[index].label = name
      }
    })
  }

  /**
   * Removes an input slot from the subgraph.
   * @param input The input slot to remove.
   */
  removeInput(input: SubgraphInput): void {
    input.disconnect()

    const index = this.inputs.indexOf(input)
    if (index === -1) throw new Error("Input not found")

    this.inputs.splice(index, 1)

    const { length } = this.inputs
    for (let i = index; i < length; i++) {
      this.inputs[i].decrementSlots("inputs")
    }

    this.#forAllNodes((node) => {
      if (node.type === this.id) {
        node.removeInput(index)
      }
    })
  }

  /**
   * Removes an output slot from the subgraph.
   * @param output The output slot to remove.
   */
  removeOutput(output: SubgraphOutput): void {
    output.disconnect()

    const index = this.outputs.indexOf(output)
    if (index === -1) throw new Error("Output not found")

    this.outputs.splice(index, 1)

    const { length } = this.outputs
    for (let i = index; i < length; i++) {
      this.outputs[i].decrementSlots("outputs")
    }

    this.#forAllNodes((node) => {
      if (node.type === this.id) {
        node.removeOutput(index)
      }
    })
  }

  draw(ctx: CanvasRenderingContext2D, colorContext: DefaultConnectionColors): void {
    this.inputNode.draw(ctx, colorContext)
    this.outputNode.draw(ctx, colorContext)
  }

  clone(): Subgraph {
    return new Subgraph(this.rootGraph, this.asSerialisable())
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
