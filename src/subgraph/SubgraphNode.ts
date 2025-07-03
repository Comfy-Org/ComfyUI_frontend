import type { SubgraphInput } from "./SubgraphInput"
import type { ISubgraphInput } from "@/interfaces"
import type { BaseLGraph, LGraph } from "@/LGraph"
import type { GraphOrSubgraph, Subgraph } from "@/subgraph/Subgraph"
import type { ExportedSubgraphInstance } from "@/types/serialisation"
import type { IBaseWidget } from "@/types/widgets"
import type { UUID } from "@/utils/uuid"

import { RecursionError } from "@/infrastructure/RecursionError"
import { LGraphNode } from "@/LGraphNode"
import { type INodeInputSlot, type ISlotType, type NodeId } from "@/litegraph"
import { LLink, type ResolvedConnection } from "@/LLink"
import { NodeInputSlot } from "@/node/NodeInputSlot"
import { NodeOutputSlot } from "@/node/NodeOutputSlot"
import { toConcreteWidget } from "@/widgets/widgetMap"

import { type ExecutableLGraphNode, ExecutableNodeDTO } from "./ExecutableNodeDTO"

/**
 * An instance of a {@link Subgraph}, displayed as a node on the containing (parent) graph.
 */
export class SubgraphNode extends LGraphNode implements BaseLGraph {
  declare inputs: (INodeInputSlot & Partial<ISubgraphInput>)[]

  override readonly type: UUID
  override readonly isVirtualNode = true as const

  get rootGraph(): LGraph {
    return this.graph.rootGraph
  }

  override get displayType(): string {
    return "Subgraph node"
  }

  override isSubgraphNode(): this is SubgraphNode {
    return true
  }

  override widgets: IBaseWidget[] = []

  constructor(
    /** The (sub)graph that contains this subgraph instance. */
    override readonly graph: GraphOrSubgraph,
    /** The definition of this subgraph; how its nodes are configured, etc. */
    readonly subgraph: Subgraph,
    instanceData: ExportedSubgraphInstance,
  ) {
    super(subgraph.name, subgraph.id)

    // Update this node when the subgraph input / output slots are changed
    const subgraphEvents = this.subgraph.events
    subgraphEvents.addEventListener("input-added", (e) => {
      const subgraphInput = e.detail.input
      const { name, type } = subgraphInput
      const input = this.addInput(name, type)

      this.#addSubgraphInputListeners(subgraphInput, input)
    })

    subgraphEvents.addEventListener("removing-input", (e) => {
      const widget = e.detail.input._widget
      if (widget) this.ensureWidgetRemoved(widget)

      this.removeInput(e.detail.index)
    })

    subgraphEvents.addEventListener("output-added", (e) => {
      const { name, type } = e.detail.output
      this.addOutput(name, type)
    })

    subgraphEvents.addEventListener("removing-output", (e) => {
      this.removeOutput(e.detail.index)
    })

    subgraphEvents.addEventListener("renaming-input", (e) => {
      const { index, newName } = e.detail
      const input = this.inputs.at(index)
      if (!input) throw new Error("Subgraph input not found")

      input.label = newName
    })

    subgraphEvents.addEventListener("renaming-output", (e) => {
      const { index, newName } = e.detail
      const output = this.outputs.at(index)
      if (!output) throw new Error("Subgraph output not found")

      output.label = newName
    })

    this.type = subgraph.id
    this.configure(instanceData)
  }

  #addSubgraphInputListeners(subgraphInput: SubgraphInput, input: INodeInputSlot & Partial<ISubgraphInput>) {
    input._listenerController?.abort()
    input._listenerController = new AbortController()
    const { signal } = input._listenerController

    subgraphInput.events.addEventListener(
      "input-connected",
      () => {
        if (input._widget) return

        const widget = subgraphInput._widget
        if (!widget) return

        this.#setWidget(subgraphInput, input, widget)
      },
      { signal },
    )

    subgraphInput.events.addEventListener(
      "input-disconnected",
      () => {
        // If the input is connected to more than one widget, don't remove the widget
        const connectedWidgets = subgraphInput.getConnectedWidgets()
        if (connectedWidgets.length > 0) return

        this.removeWidgetByName(input.name)

        delete input.pos
        delete input.widget
        input._widget = undefined
      },
      { signal },
    )
  }

  override configure(info: ExportedSubgraphInstance): void {
    for (const input of this.inputs) {
      input._listenerController?.abort()
    }

    this.inputs.length = 0
    this.inputs.push(
      ...this.subgraph.inputNode.slots.map(
        slot => new NodeInputSlot({ name: slot.name, localized_name: slot.localized_name, label: slot.label, type: slot.type, link: null }, this),
      ),
    )

    this.outputs.length = 0
    this.outputs.push(
      ...this.subgraph.outputNode.slots.map(
        slot => new NodeOutputSlot({ name: slot.name, localized_name: slot.localized_name, label: slot.label, type: slot.type, links: null }, this),
      ),
    )

    super.configure(info)
  }

  override _internalConfigureAfterSlots() {
    // Reset widgets
    this.widgets.length = 0

    // Check all inputs for connected widgets
    for (const input of this.inputs) {
      const subgraphInput = this.subgraph.inputNode.slots.find(slot => slot.name === input.name)
      if (!subgraphInput) throw new Error(`[SubgraphNode.configure] No subgraph input found for input ${input.name}`)

      this.#addSubgraphInputListeners(subgraphInput, input)

      // Find the first widget that this slot is connected to
      for (const linkId of subgraphInput.linkIds) {
        const link = this.subgraph.getLink(linkId)
        if (!link) {
          console.warn(`[SubgraphNode.configure] No link found for link ID ${linkId}`, this)
          continue
        }

        const resolved = link.resolve(this.subgraph)
        if (!resolved.input || !resolved.inputNode) {
          console.warn("Invalid resolved link", resolved, this)
          continue
        }

        // No widget - ignore this link
        const widget = resolved.inputNode.getWidgetFromSlot(resolved.input)
        if (!widget) continue

        this.#setWidget(subgraphInput, input, widget)
        break
      }
    }
  }

  #setWidget(subgraphInput: Readonly<SubgraphInput>, input: INodeInputSlot, widget: Readonly<IBaseWidget>) {
    // Use the first matching widget
    const promotedWidget = toConcreteWidget(widget, this).createCopyForNode(this)
    Object.assign(promotedWidget, {
      get name() {
        return subgraphInput.name
      },
      set name(value) {
        console.warn("Promoted widget: setting name is not allowed", this, value)
      },
      get localized_name() {
        return subgraphInput.localized_name
      },
      set localized_name(value) {
        console.warn("Promoted widget: setting localized_name is not allowed", this, value)
      },
      get label() {
        return subgraphInput.label
      },
      set label(value) {
        console.warn("Promoted widget: setting label is not allowed", this, value)
      },
    })

    this.widgets.push(promotedWidget)

    input.widget = { name: subgraphInput.name }
    input._widget = promotedWidget
  }

  /**
   * Ensures the subgraph slot is in the params before adding the input as normal.
   * @param name The name of the input slot.
   * @param type The type of the input slot.
   * @param inputProperties Properties that are directly assigned to the created input. Default: a new, empty object.
   * @returns The new input slot.
   * @remarks Assertion is required to instantiate empty generic POJO.
   */
  override addInput<TInput extends Partial<ISubgraphInput>>(name: string, type: ISlotType, inputProperties: TInput = {} as TInput): INodeInputSlot & TInput {
    // Bypasses type narrowing on this.inputs
    return super.addInput(name, type, inputProperties)
  }

  override getInputLink(slot: number): LLink | null {
    // Output side: the link from inside the subgraph
    const innerLink = this.subgraph.outputNode.slots[slot].getLinks().at(0)
    if (!innerLink) {
      console.warn(`SubgraphNode.getInputLink: no inner link found for slot ${slot}`)
      return null
    }

    const newLink = LLink.create(innerLink)
    newLink.origin_id = `${this.id}:${innerLink.origin_id}`
    newLink.origin_slot = innerLink.origin_slot

    return newLink
  }

  /**
   * Finds the internal links connected to the given input slot inside the subgraph, and resolves the nodes / slots.
   * @param slot The slot index
   * @returns The resolved connections, or undefined if no input node is found.
   * @remarks This is used to resolve the input links when dragging a link from a subgraph input slot.
   */
  resolveSubgraphInputLinks(slot: number): ResolvedConnection[] {
    const inputSlot = this.subgraph.inputNode.slots[slot]
    const innerLinks = inputSlot.getLinks()
    if (innerLinks.length === 0) {
      console.debug(`[SubgraphNode.resolveSubgraphInputLinks] No inner links found for input slot [${slot}] ${inputSlot.name}`, this)
      return []
    }
    return innerLinks.map(link => link.resolve(this.subgraph))
  }

  /**
   * Finds the internal link connected to the given output slot inside the subgraph, and resolves the nodes / slots.
   * @param slot The slot index
   * @returns The output node if found, otherwise undefined.
   */
  resolveSubgraphOutputLink(slot: number): ResolvedConnection | undefined {
    const outputSlot = this.subgraph.outputNode.slots[slot]
    const innerLink = outputSlot.getLinks().at(0)
    if (innerLink) return innerLink.resolve(this.subgraph)

    console.debug(`[SubgraphNode.resolveSubgraphOutputLink] No inner link found for output slot [${slot}] ${outputSlot.name}`, this)
  }

  /** @internal Used to flatten the subgraph before execution. Recursive; call with no args. */
  getInnerNodes(
    /** The list of nodes to add to. */
    nodes: ExecutableLGraphNode[] = [],
    /** The set of visited nodes. */
    visited = new WeakSet<SubgraphNode>(),
    /** The path of subgraph node IDs. */
    subgraphNodePath: readonly NodeId[] = [],
  ): ExecutableLGraphNode[] {
    if (visited.has(this)) throw new RecursionError("while flattening subgraph")
    visited.add(this)

    const subgraphInstanceIdPath = [...subgraphNodePath, this.id]

    for (const node of this.subgraph.nodes) {
      if ("getInnerNodes" in node) {
        node.getInnerNodes(nodes, visited, subgraphInstanceIdPath)
      } else {
        // Create minimal DTOs rather than cloning the node
        const aVeryRealNode = new ExecutableNodeDTO(node, subgraphInstanceIdPath, this)
        nodes.push(aVeryRealNode)
      }
    }
    return nodes
  }

  override onRemoved(): void {
    for (const input of this.inputs) {
      input._listenerController?.abort()
    }
  }
}
