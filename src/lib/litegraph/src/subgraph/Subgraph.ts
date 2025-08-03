import type { SubgraphEventMap } from "@/infrastructure/SubgraphEventMap"
import type { DefaultConnectionColors, INodeInputSlot, INodeOutputSlot } from "@/interfaces"
import type { LGraphCanvas } from "@/LGraphCanvas"
import type { ExportedSubgraph, ExposedWidget, ISerialisedGraph, Serialisable, SerialisableGraph } from "@/types/serialisation"

import { CustomEventTarget } from "@/infrastructure/CustomEventTarget"
import { type BaseLGraph, LGraph } from "@/LGraph"
import { createUuidv4 } from "@/utils/uuid"

import { SubgraphInput } from "./SubgraphInput"
import { SubgraphInputNode } from "./SubgraphInputNode"
import { SubgraphOutput } from "./SubgraphOutput"
import { SubgraphOutputNode } from "./SubgraphOutputNode"

/** Internal; simplifies type definitions. */
export type GraphOrSubgraph = LGraph | Subgraph

/** A subgraph definition. */
export class Subgraph extends LGraph implements BaseLGraph, Serialisable<ExportedSubgraph> {
  declare readonly events: CustomEventTarget<SubgraphEventMap>

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
        const subgraphInput = new SubgraphInput(input, this.inputNode)
        this.inputs.push(subgraphInput)
        this.events.dispatch("input-added", { input: subgraphInput })
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
    this.events.dispatch("adding-input", { name, type })

    const input = new SubgraphInput({
      id: createUuidv4(),
      name,
      type,
    }, this.inputNode)

    this.inputs.push(input)
    this.events.dispatch("input-added", { input })

    return input
  }

  addOutput(name: string, type: string): SubgraphOutput {
    this.events.dispatch("adding-output", { name, type })

    const output = new SubgraphOutput({
      id: createUuidv4(),
      name,
      type,
    }, this.outputNode)

    this.outputs.push(output)
    this.events.dispatch("output-added", { output })

    return output
  }

  /**
   * Renames an input slot in the subgraph.
   * @param input The input slot to rename.
   * @param name The new name for the input slot.
   */
  renameInput(input: SubgraphInput, name: string): void {
    const index = this.inputs.indexOf(input)
    if (index === -1) throw new Error("Input not found")

    const oldName = input.displayName
    this.events.dispatch("renaming-input", { input, index, oldName, newName: name })

    input.label = name
  }

  /**
   * Renames an output slot in the subgraph.
   * @param output The output slot to rename.
   * @param name The new name for the output slot.
   */
  renameOutput(output: SubgraphOutput, name: string): void {
    const index = this.outputs.indexOf(output)
    if (index === -1) throw new Error("Output not found")

    const oldName = output.displayName
    this.events.dispatch("renaming-output", { output, index, oldName, newName: name })

    output.label = name
  }

  /**
   * Removes an input slot from the subgraph.
   * @param input The input slot to remove.
   */
  removeInput(input: SubgraphInput): void {
    input.disconnect()

    const index = this.inputs.indexOf(input)
    if (index === -1) throw new Error("Input not found")

    const mayContinue = this.events.dispatch("removing-input", { input, index })
    if (!mayContinue) return

    this.inputs.splice(index, 1)

    const { length } = this.inputs
    for (let i = index; i < length; i++) {
      this.inputs[i].decrementSlots("inputs")
    }
  }

  /**
   * Removes an output slot from the subgraph.
   * @param output The output slot to remove.
   */
  removeOutput(output: SubgraphOutput): void {
    output.disconnect()

    const index = this.outputs.indexOf(output)
    if (index === -1) throw new Error("Output not found")

    const mayContinue = this.events.dispatch("removing-output", { output, index })
    if (!mayContinue) return

    this.outputs.splice(index, 1)

    const { length } = this.outputs
    for (let i = index; i < length; i++) {
      this.outputs[i].decrementSlots("outputs")
    }
  }

  draw(ctx: CanvasRenderingContext2D, colorContext: DefaultConnectionColors, fromSlot?: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput, editorAlpha?: number): void {
    this.inputNode.draw(ctx, colorContext, fromSlot, editorAlpha)
    this.outputNode.draw(ctx, colorContext, fromSlot, editorAlpha)
  }

  /**
   * Clones the subgraph, creating an identical copy with a new ID.
   * @returns A new subgraph with the same configuration, but a new ID.
   */
  clone(keepId: boolean = false): Subgraph {
    const exported = this.asSerialisable()
    if (!keepId) exported.id = createUuidv4()

    const subgraph = new Subgraph(this.rootGraph, exported)
    subgraph.configure(exported)
    return subgraph
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
