import type { SubgraphNode } from "./SubgraphNode"
import type { CallbackParams, CallbackReturn, ISlotType } from "@/interfaces"
import type { LGraph } from "@/LGraph"
import type { LGraphNode, NodeId } from "@/LGraphNode"

import { InvalidLinkError } from "@/infrastructure/InvalidLinkError"
import { NullGraphError } from "@/infrastructure/NullGraphError"
import { RecursionError } from "@/infrastructure/RecursionError"
import { SlotIndexError } from "@/infrastructure/SlotIndexError"
import { LGraphEventMode } from "@/litegraph"

import { Subgraph } from "./Subgraph"

/**
 * Interface describing the data transfer objects used when compiling a graph for execution.
 */
export type ExecutableLGraphNode = Omit<ExecutableNodeDTO, "graph" | "node" | "subgraphNodePath" | "subgraphNode">

type NodeAndInput = {
  node: ExecutableLGraphNode
  origin_id: NodeId
  origin_slot: number
}

/**
 * Concrete implementation of {@link ExecutableLGraphNode}.
 * @remarks This is the class that is used to create the data transfer objects for executable nodes.
 */
export class ExecutableNodeDTO implements ExecutableLGraphNode {
  applyToGraph?(...args: CallbackParams<typeof this.node.applyToGraph>): CallbackReturn<typeof this.node.applyToGraph>

  /** The graph that this node is a part of. */
  readonly graph: LGraph | Subgraph

  inputs: { linkId: number | null, name: string, type: ISlotType }[]

  /** Backing field for {@link id}. */
  #id: NodeId

  /**
   * The path to the acutal node through subgraph instances, represented as a list of all subgraph node IDs (instances),
   * followed by the actual original node ID within the subgraph. Each segment is separated by `:`.
   *
   * e.g. `1:2:3`:
   * - `1` is the node ID of the first subgraph node in the parent workflow
   * - `2` is the node ID of the second subgraph node in the first subgraph
   * - `3` is the node ID of the actual node in the subgraph definition
   */
  get id() {
    return this.#id
  }

  get type() {
    return this.node.type
  }

  get title() {
    return this.node.title
  }

  get mode() {
    return this.node.mode
  }

  get comfyClass() {
    return this.node.comfyClass
  }

  get isVirtualNode() {
    return this.node.isVirtualNode
  }

  get widgets() {
    return this.node.widgets
  }

  constructor(
    /** The actual node that this DTO wraps. */
    readonly node: LGraphNode | SubgraphNode,
    /** A list of subgraph instance node IDs from the root graph to the containing instance. @see {@link id} */
    readonly subgraphNodePath: readonly NodeId[],
    /** The actual subgraph instance that contains this node, otherise undefined. */
    readonly subgraphNode?: SubgraphNode,
  ) {
    if (!node.graph) throw new NullGraphError()

    // Set the internal ID of the DTO
    this.#id = [...this.subgraphNodePath, this.node.id].join(":")
    this.graph = node.graph
    this.inputs = this.node.inputs.map(x => ({
      linkId: x.link,
      name: x.name,
      type: x.type,
    }))

    // Only create a wrapper if the node has an applyToGraph method
    if (this.node.applyToGraph) {
      this.applyToGraph = (...args) => this.node.applyToGraph?.(...args)
    }
  }

  /** Returns either the DTO itself, or the DTOs of the inner nodes of the subgraph. */
  getInnerNodes(): ExecutableLGraphNode[] {
    return this.subgraphNode ? this.subgraphNode.getInnerNodes() : [this]
  }

  /**
   * Resolves the executable node & link IDs for a given input slot.
   * @param slot The slot index of the input.
   * @param visited Leave empty unless overriding this method.
   * A set of unique IDs, used to guard against infinite recursion.
   * If overriding, ensure that the set is passed on all recursive calls.
   * @returns The node and the origin ID / slot index of the output.
   */
  resolveInput(slot: number, visited = new Set<string>()): NodeAndInput | undefined {
    const uniqueId = `${this.subgraphNode?.subgraph.id}:${this.node.id}[I]${slot}`
    if (visited.has(uniqueId)) throw new RecursionError(`While resolving subgraph input [${uniqueId}]`)
    visited.add(uniqueId)

    const input = this.inputs.at(slot)
    if (!input) throw new SlotIndexError(`No input found for flattened id [${this.id}] slot [${slot}]`)

    // Nothing connected
    if (input.linkId == null) return

    const link = this.graph.getLink(input.linkId)
    if (!link) throw new InvalidLinkError(`No link found in parent graph for id [${this.id}] slot [${slot}] ${input.name}`)

    const { subgraphNode } = this

    // Link goes up and out of this subgraph
    if (subgraphNode && link.originIsIoNode) {
      const subgraphNodeInput = subgraphNode.inputs.at(link.origin_slot)
      if (!subgraphNodeInput) throw new SlotIndexError(`No input found for slot [${link.origin_slot}] ${input.name}`)

      // Nothing connected
      const linkId = subgraphNodeInput.link
      if (linkId == null) return

      const outerLink = subgraphNode.graph.getLink(linkId)
      if (!outerLink) throw new InvalidLinkError(`No outer link found for slot [${link.origin_slot}] ${input.name}`)

      // Translate subgraph node IDs to instances (not worth optimising yet)
      const subgraphNodes = this.graph.rootGraph.resolveSubgraphIdPath(this.subgraphNodePath)

      const subgraphNodeDto = new ExecutableNodeDTO(subgraphNode, this.subgraphNodePath.slice(0, -1), subgraphNodes.at(-2))
      return subgraphNodeDto.resolveInput(outerLink.target_slot, visited)
    }

    // Not part of a subgraph; use the original link
    const outputNode = this.graph.getNodeById(link.origin_id)
    if (!outputNode) throw new InvalidLinkError(`No input node found for id [${this.id}] slot [${slot}] ${input.name}`)

    const outputNodeDto = new ExecutableNodeDTO(outputNode, this.subgraphNodePath, subgraphNode)

    return outputNodeDto.resolveOutput(link.origin_slot, input.type, visited)
  }

  /**
   * Determines whether this output is a valid endpoint for a link (non-virtual, non-bypass).
   * @param slot The slot index of the output.
   * @param type The type of the input
   * @param visited A set of unique IDs to guard against infinite recursion. See {@link resolveInput}.
   * @returns The node and the origin ID / slot index of the output.
   */
  resolveOutput(slot: number, type: ISlotType, visited: Set<string>): NodeAndInput | undefined {
    const uniqueId = `${this.subgraphNode?.subgraph.id}:${this.node.id}[O]${slot}`
    if (visited.has(uniqueId)) throw new RecursionError(`While resolving subgraph output [${uniqueId}]`)
    visited.add(uniqueId)

    // Upstreamed: Bypass nodes are bypassed using the first input with matching type
    if (this.mode === LGraphEventMode.BYPASS) {
      const { inputs } = this

      // Bypass nodes by finding first input with matching type
      const parentInputIndexes = Object.keys(inputs).map(Number)
      // Prioritise exact slot index
      const indexes = [slot, ...parentInputIndexes]
      const matchingIndex = indexes.find(i => inputs[i]?.type === type)

      // No input types match
      if (matchingIndex === undefined) {
        console.debug(`[ExecutableNodeDTO.resolveOutput] No input types match type [${type}] for id [${this.id}] slot [${slot}]`, this)
        return
      }

      return this.resolveInput(matchingIndex, visited)
    }

    const { node } = this
    if (node.isSubgraphNode()) return this.#resolveSubgraphOutput(slot, type, visited)

    // Upstreamed: Other virtual nodes are bypassed using the same input/output index (slots must match)
    if (node.isVirtualNode) {
      if (this.inputs.at(slot)) return this.resolveInput(slot, visited)

      // Virtual nodes without a matching input should be discarded.
      return
    }

    return {
      node: this,
      origin_id: this.id,
      origin_slot: slot,
    }
  }

  /**
   * Resolves the link inside a subgraph node, from the subgraph IO node to the node inside the subgraph.
   * @param slot The slot index of the output on the subgraph node.
   * @param visited A set of unique IDs to guard against infinite recursion. See {@link resolveInput}.
   * @returns A DTO for the node, and the origin ID / slot index of the output.
   */
  #resolveSubgraphOutput(slot: number, type: ISlotType, visited: Set<string>): NodeAndInput | undefined {
    const { node } = this
    const output = node.outputs.at(slot)

    if (!output) throw new SlotIndexError(`No output found for flattened id [${this.id}] slot [${slot}]`)
    if (!node.isSubgraphNode()) throw new TypeError(`Node is not a subgraph node: ${node.id}`)

    // Link inside the subgraph
    const innerResolved = node.resolveSubgraphOutputLink(slot)
    if (!innerResolved) return

    const innerNode = innerResolved.outputNode
    if (!innerNode) throw new Error(`No output node found for id [${this.id}] slot [${slot}] ${output.name}`)

    // Recurse into the subgraph
    const innerNodeDto = new ExecutableNodeDTO(innerNode, [...this.subgraphNodePath, node.id], node)
    return innerNodeDto.resolveOutput(innerResolved.link.origin_slot, type, visited)
  }
}
