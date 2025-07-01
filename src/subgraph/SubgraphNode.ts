import type { ISubgraphInput } from "@/interfaces"
import type { BaseLGraph, LGraph } from "@/LGraph"
import type { INodeInputSlot, ISlotType, NodeId } from "@/litegraph"
import type { GraphOrSubgraph, Subgraph } from "@/subgraph/Subgraph"
import type { ExportedSubgraphInstance } from "@/types/serialisation"
import type { UUID } from "@/utils/uuid"

import { RecursionError } from "@/infrastructure/RecursionError"
import { LGraphNode } from "@/LGraphNode"
import { LLink, type ResolvedConnection } from "@/LLink"
import { NodeInputSlot } from "@/node/NodeInputSlot"
import { NodeOutputSlot } from "@/node/NodeOutputSlot"

import { type ExecutableLGraphNode, ExecutableNodeDTO } from "./ExecutableNodeDTO"

/**
 * An instance of a {@link Subgraph}, displayed as a node on the containing (parent) graph.
 */
export class SubgraphNode extends LGraphNode implements BaseLGraph {
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
      const { name, type } = e.detail.input
      this.addInput(name, type)
    })
    subgraphEvents.addEventListener("removing-input", (e) => {
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

  override configure(info: ExportedSubgraphInstance): void {
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
}
