import type { RenderLink } from "./RenderLink"
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
    this.outputPos = outputNode.getConnectionPos(false, outputIndex)

    // Store input info
    const inputNode = network.getNodeById(inputNodeId) ?? undefined
    if (!inputNode) throw new Error(`Creating DraggingRenderLink for link [${link.id}] failed: Input node [${inputNodeId}] not found.`)

    const inputSlot = inputNode.inputs.at(inputIndex)
    if (!inputSlot) throw new Error(`Creating DraggingRenderLink for link [${link.id}] failed: Input slot [${inputIndex}] not found.`)

    this.inputNodeId = inputNodeId
    this.inputNode = inputNode
    this.inputSlot = inputSlot
    this.inputIndex = inputIndex
    this.inputPos = inputNode.getConnectionPos(true, inputIndex)

    // RenderLink props
    this.node = this.toType === "input" ? outputNode : inputNode
    this.fromSlot = this.toType === "input" ? outputSlot : inputSlot
    this.fromPos = fromReroute?.pos ?? (this.toType === "input" ? this.outputPos : this.inputPos)
    this.fromDirection = this.toType === "input" ? LinkDirection.NONE : LinkDirection.LEFT
    this.fromSlotIndex = this.toType === "input" ? outputIndex : inputIndex
  }
}
