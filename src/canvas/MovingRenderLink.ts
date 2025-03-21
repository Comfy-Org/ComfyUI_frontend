import type { RenderLink } from "./RenderLink"
import type { LinkConnectorEventTarget } from "@/infrastructure/LinkConnectorEventTarget"
import type { INodeOutputSlot, LinkNetwork } from "@/interfaces"
import type { INodeInputSlot } from "@/interfaces"
import type { Point } from "@/interfaces"
import type { LGraphNode, NodeId } from "@/LGraphNode"
import type { LLink } from "@/LLink"
import type { Reroute } from "@/Reroute"

import { LinkDirection } from "@/types/globalEnums"

/**
 * Represents an existing link that is currently being dragged by the user from one slot to another.
 *
 * This is a heavier, but short-lived convenience data structure. All refs to MovingRenderLinks should be discarded on drop.
 * @remarks
 * At time of writing, Litegraph is using several different styles and methods to handle link dragging.
 *
 * Once the library has undergone more substantial changes to the way links are managed,
 * many properties of this class will be superfluous and removable.
 */
export class MovingRenderLink implements RenderLink {
  readonly node: LGraphNode
  readonly fromSlot: INodeOutputSlot | INodeInputSlot
  readonly fromPos: Point
  readonly fromDirection: LinkDirection
  readonly fromSlotIndex: number

  readonly outputNodeId: NodeId
  readonly outputNode: LGraphNode
  readonly outputSlot: INodeOutputSlot
  readonly outputIndex: number
  readonly outputPos: Point

  readonly inputNodeId: NodeId
  readonly inputNode: LGraphNode
  readonly inputSlot: INodeInputSlot
  readonly inputIndex: number
  readonly inputPos: Point

  constructor(
    readonly network: LinkNetwork,
    readonly link: LLink,
    readonly toType: "input" | "output",
    readonly fromReroute?: Reroute,
    readonly dragDirection: LinkDirection = LinkDirection.CENTER,
  ) {
    const {
      origin_id: outputNodeId,
      target_id: inputNodeId,
      origin_slot: outputIndex,
      target_slot: inputIndex,
    } = link

    // Store output info
    const outputNode = network.getNodeById(outputNodeId) ?? undefined
    if (!outputNode) throw new Error(`Creating DraggingRenderLink for link [${link.id}] failed: Output node [${outputNodeId}] not found.`)

    const outputSlot = outputNode.outputs.at(outputIndex)
    if (!outputSlot) throw new Error(`Creating DraggingRenderLink for link [${link.id}] failed: Output slot [${outputIndex}] not found.`)

    this.outputNodeId = outputNodeId
    this.outputNode = outputNode
    this.outputSlot = outputSlot
    this.outputIndex = outputIndex
    this.outputPos = outputNode.getOutputPos(outputIndex)

    // Store input info
    const inputNode = network.getNodeById(inputNodeId) ?? undefined
    if (!inputNode) throw new Error(`Creating DraggingRenderLink for link [${link.id}] failed: Input node [${inputNodeId}] not found.`)

    const inputSlot = inputNode.inputs.at(inputIndex)
    if (!inputSlot) throw new Error(`Creating DraggingRenderLink for link [${link.id}] failed: Input slot [${inputIndex}] not found.`)

    this.inputNodeId = inputNodeId
    this.inputNode = inputNode
    this.inputSlot = inputSlot
    this.inputIndex = inputIndex
    this.inputPos = inputNode.getInputPos(inputIndex)

    // RenderLink props
    this.node = this.toType === "input" ? outputNode : inputNode
    this.fromSlot = this.toType === "input" ? outputSlot : inputSlot
    this.fromPos = fromReroute?.pos ?? (this.toType === "input" ? this.outputPos : this.inputPos)
    this.fromDirection = this.toType === "input" ? LinkDirection.NONE : LinkDirection.LEFT
    this.fromSlotIndex = this.toType === "input" ? outputIndex : inputIndex
  }

  connectToInput(inputNode: LGraphNode, input: INodeInputSlot, events: LinkConnectorEventTarget): LLink | null | undefined {
    if (input === this.inputSlot) return

    const link = this.outputNode.connectSlots(this.outputSlot, inputNode, input, this.fromReroute?.id)
    if (link) events.dispatch("input-moved", this)
    return link
  }

  connectToOutput(outputNode: LGraphNode, output: INodeOutputSlot, events: LinkConnectorEventTarget): LLink | null | undefined {
    if (output === this.outputSlot) return

    const link = outputNode.connectSlots(output, this.inputNode, this.inputSlot, this.link.parentId)
    if (link) events.dispatch("output-moved", this)
    return link
  }

  connectToRerouteInput(
    reroute: Reroute,
    { node: inputNode, input, link: existingLink }: { node: LGraphNode, input: INodeInputSlot, link: LLink },
    events: LinkConnectorEventTarget,
    originalReroutes: Reroute[],
  ): void {
    const { outputNode, outputSlot, fromReroute } = this

    // Clean up reroutes
    for (const reroute of originalReroutes) {
      if (reroute.id === this.link.parentId) break

      if (reroute.totalLinks === 1) reroute.remove()
    }
    // Set the parentId of the reroute we dropped on, to the reroute we dragged from
    reroute.parentId = fromReroute?.id

    const newLink = outputNode.connectSlots(outputSlot, inputNode, input, existingLink.parentId)
    if (newLink) events.dispatch("input-moved", this)
  }

  connectToRerouteOutput(
    reroute: Reroute,
    outputNode: LGraphNode,
    output: INodeOutputSlot,
    events: LinkConnectorEventTarget,
  ): void {
    // Moving output side of links
    const { inputNode, inputSlot, fromReroute } = this

    // Creating a new link removes floating prop - check before connecting
    const floatingTerminus = reroute?.floating?.slotType === "output"

    // Connect the first reroute of the link being dragged to the reroute being dropped on
    if (fromReroute) {
      fromReroute.parentId = reroute.id
    } else {
      // If there are no reroutes, directly connect the link
      this.link.parentId = reroute.id
    }
    // Use the last reroute id on the link to retain all reroutes
    outputNode.connectSlots(output, inputNode, inputSlot, this.link.parentId)

    // Connecting from the final reroute of a floating reroute chain
    if (floatingTerminus) reroute.removeAllFloatingLinks()

    events.dispatch("output-moved", this)
  }
}
