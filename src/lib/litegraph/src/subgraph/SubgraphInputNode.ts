import type { SubgraphInput } from "./SubgraphInput"
import type { LinkConnector } from "@/canvas/LinkConnector"
import type { CanvasPointer } from "@/CanvasPointer"
import type { DefaultConnectionColors, INodeInputSlot, ISlotType, Positionable } from "@/interfaces"
import type { LGraphNode, NodeId } from "@/LGraphNode"
import type { RerouteId } from "@/Reroute"
import type { CanvasPointerEvent } from "@/types/events"
import type { NodeLike } from "@/types/NodeLike"

import { SUBGRAPH_INPUT_ID } from "@/constants"
import { Rectangle } from "@/infrastructure/Rectangle"
import { LLink } from "@/LLink"
import { NodeSlotType } from "@/types/globalEnums"
import { findFreeSlotOfType } from "@/utils/collections"

import { EmptySubgraphInput } from "./EmptySubgraphInput"
import { SubgraphIONodeBase } from "./SubgraphIONodeBase"

export class SubgraphInputNode extends SubgraphIONodeBase<SubgraphInput> implements Positionable {
  readonly id: NodeId = SUBGRAPH_INPUT_ID

  readonly emptySlot: EmptySubgraphInput = new EmptySubgraphInput(this)

  get slots() {
    return this.subgraph.inputs
  }

  override get allSlots(): SubgraphInput[] {
    return [...this.slots, this.emptySlot]
  }

  get slotAnchorX() {
    const [x, , width] = this.boundingRect
    return x + width - SubgraphIONodeBase.roundedRadius
  }

  override onPointerDown(e: CanvasPointerEvent, pointer: CanvasPointer, linkConnector: LinkConnector): void {
    // Left-click handling for dragging connections
    if (e.button === 0) {
      for (const slot of this.allSlots) {
        const slotBounds = Rectangle.fromCentre(slot.pos, slot.boundingRect.height)

        if (slotBounds.containsXy(e.canvasX, e.canvasY)) {
          pointer.onDragStart = () => {
            linkConnector.dragNewFromSubgraphInput(this.subgraph, this, slot)
          }
          pointer.onDragEnd = (eUp) => {
            linkConnector.dropLinks(this.subgraph, eUp)
          }
          pointer.finally = () => {
            linkConnector.reset(true)
          }
        }
      }
    // Check for right-click
    } else if (e.button === 2) {
      const slot = this.getSlotInPosition(e.canvasX, e.canvasY)
      if (slot) this.showSlotContextMenu(slot, e)
    }
  }

  /** @inheritdoc */
  override renameSlot(slot: SubgraphInput, name: string): void {
    this.subgraph.renameInput(slot, name)
  }

  /** @inheritdoc */
  override removeSlot(slot: SubgraphInput): void {
    this.subgraph.removeInput(slot)
  }

  canConnectTo(inputNode: NodeLike, input: INodeInputSlot, fromSlot: SubgraphInput): boolean {
    return inputNode.canConnectTo(this, input, fromSlot)
  }

  connectSlots(fromSlot: SubgraphInput, inputNode: LGraphNode, input: INodeInputSlot, afterRerouteId: RerouteId | undefined): LLink {
    const { subgraph } = this

    const outputIndex = this.slots.indexOf(fromSlot)
    const inputIndex = inputNode.inputs.indexOf(input)

    if (outputIndex === -1 || inputIndex === -1) throw new Error("Invalid slot indices.")

    return new LLink(
      ++subgraph.state.lastLinkId,
      input.type || fromSlot.type,
      this.id,
      outputIndex,
      inputNode.id,
      inputIndex,
      afterRerouteId,
    )
  }

  // #region Legacy LGraphNode compatibility

  connectByType(
    slot: number,
    target_node: LGraphNode,
    target_slotType: ISlotType,
    optsIn?: { afterRerouteId?: RerouteId },
  ): LLink | undefined {
    const inputSlot = target_node.findInputByType(target_slotType)
    if (!inputSlot) return

    return this.slots[slot].connect(inputSlot.slot, target_node, optsIn?.afterRerouteId)
  }

  findOutputSlot(name: string): SubgraphInput | undefined {
    return this.slots.find(output => output.name === name)
  }

  findOutputByType(type: ISlotType): SubgraphInput | undefined {
    return findFreeSlotOfType(this.slots, type, slot => slot.linkIds.length > 0)?.slot
  }

  // #endregion Legacy LGraphNode compatibility

  _disconnectNodeInput(node: LGraphNode, input: INodeInputSlot, link: LLink | undefined): void {
    const { subgraph } = this

    // Break floating links
    if (input._floatingLinks?.size) {
      for (const link of input._floatingLinks) {
        subgraph.removeFloatingLink(link)
      }
    }

    input.link = null
    subgraph.setDirtyCanvas(false, true)

    if (!link) return

    const subgraphInputIndex = link.origin_slot
    link.disconnect(subgraph, "output")
    subgraph._version++

    const subgraphInput = this.slots.at(subgraphInputIndex)
    if (!subgraphInput) {
      console.debug("disconnectNodeInput: subgraphInput not found", this, subgraphInputIndex)
      return
    }

    // search in the inputs list for this link
    const index = subgraphInput.linkIds.indexOf(link.id)
    if (index !== -1) {
      subgraphInput.linkIds.splice(index, 1)
    } else {
      console.debug("disconnectNodeInput: link ID not found in subgraphInput linkIds", link.id)
    }

    node.onConnectionsChange?.(
      NodeSlotType.OUTPUT,
      index,
      false,
      link,
      subgraphInput,
    )
  }

  override drawProtected(ctx: CanvasRenderingContext2D, colorContext: DefaultConnectionColors): void {
    const { roundedRadius } = SubgraphIONodeBase
    const transform = ctx.getTransform()

    const [x, y, width, height] = this.boundingRect
    ctx.translate(x, y)

    // Draw top rounded part
    ctx.strokeStyle = this.sideStrokeStyle
    ctx.lineWidth = this.sideLineWidth
    ctx.beginPath()
    ctx.arc(width - roundedRadius, roundedRadius, roundedRadius, Math.PI * 1.5, 0)

    // Straight line to bottom
    ctx.moveTo(width, roundedRadius)
    ctx.lineTo(width, height - roundedRadius)

    // Bottom rounded part
    ctx.arc(width - roundedRadius, height - roundedRadius, roundedRadius, 0, Math.PI * 0.5)
    ctx.stroke()

    // Restore context
    ctx.setTransform(transform)

    this.drawSlots(ctx, colorContext)
  }
}
