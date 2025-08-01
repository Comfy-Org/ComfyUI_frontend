import type { SubgraphInput } from "./SubgraphInput"
import type { SubgraphOutput } from "./SubgraphOutput"
import type { LinkConnector } from "@/canvas/LinkConnector"
import type { CanvasPointer } from "@/CanvasPointer"
import type { DefaultConnectionColors, INodeInputSlot, INodeOutputSlot, ISlotType, Positionable } from "@/interfaces"
import type { LGraphNode, NodeId } from "@/LGraphNode"
import type { LLink } from "@/LLink"
import type { RerouteId } from "@/Reroute"
import type { CanvasPointerEvent } from "@/types/events"
import type { NodeLike } from "@/types/NodeLike"
import type { SubgraphIO } from "@/types/serialisation"

import { SUBGRAPH_OUTPUT_ID } from "@/constants"
import { Rectangle } from "@/infrastructure/Rectangle"
import { findFreeSlotOfType } from "@/utils/collections"

import { EmptySubgraphOutput } from "./EmptySubgraphOutput"
import { SubgraphIONodeBase } from "./SubgraphIONodeBase"

export class SubgraphOutputNode extends SubgraphIONodeBase<SubgraphOutput> implements Positionable {
  readonly id: NodeId = SUBGRAPH_OUTPUT_ID

  readonly emptySlot: EmptySubgraphOutput = new EmptySubgraphOutput(this)

  get slots() {
    return this.subgraph.outputs
  }

  override get allSlots(): SubgraphOutput[] {
    return [...this.slots, this.emptySlot]
  }

  get slotAnchorX() {
    const [x] = this.boundingRect
    return x + SubgraphIONodeBase.roundedRadius
  }

  override onPointerDown(e: CanvasPointerEvent, pointer: CanvasPointer, linkConnector: LinkConnector): void {
    // Left-click handling for dragging connections
    if (e.button === 0) {
      for (const slot of this.allSlots) {
        const slotBounds = Rectangle.fromCentre(slot.pos, slot.boundingRect.height)

        if (slotBounds.containsXy(e.canvasX, e.canvasY)) {
          pointer.onDragStart = () => {
            linkConnector.dragNewFromSubgraphOutput(this.subgraph, this, slot)
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
  override renameSlot(slot: SubgraphOutput, name: string): void {
    this.subgraph.renameOutput(slot, name)
  }

  /** @inheritdoc */
  override removeSlot(slot: SubgraphOutput): void {
    this.subgraph.removeOutput(slot)
  }

  canConnectTo(outputNode: NodeLike, fromSlot: SubgraphOutput, output: INodeOutputSlot | SubgraphIO): boolean {
    return outputNode.canConnectTo(this, fromSlot, output)
  }

  connectByTypeOutput(
    slot: number,
    target_node: LGraphNode,
    target_slotType: ISlotType,
    optsIn?: { afterRerouteId?: RerouteId },
  ): LLink | undefined {
    const outputSlot = target_node.findOutputByType(target_slotType)
    if (!outputSlot) return

    return this.slots[slot].connect(outputSlot.slot, target_node, optsIn?.afterRerouteId)
  }

  findInputByType(type: ISlotType): SubgraphOutput | undefined {
    return findFreeSlotOfType(this.slots, type, slot => slot.linkIds.length > 0)?.slot
  }

  override drawProtected(ctx: CanvasRenderingContext2D, colorContext: DefaultConnectionColors, fromSlot?: INodeInputSlot | INodeOutputSlot | SubgraphInput | SubgraphOutput, editorAlpha?: number): void {
    const { roundedRadius } = SubgraphIONodeBase
    const transform = ctx.getTransform()

    const [x, y, , height] = this.boundingRect
    ctx.translate(x, y)

    // Draw bottom rounded part
    ctx.strokeStyle = this.sideStrokeStyle
    ctx.lineWidth = this.sideLineWidth
    ctx.beginPath()
    ctx.arc(roundedRadius, roundedRadius, roundedRadius, Math.PI, Math.PI * 1.5)

    // Straight line to bottom
    ctx.moveTo(0, roundedRadius)
    ctx.lineTo(0, height - roundedRadius)

    // Bottom rounded part
    ctx.arc(roundedRadius, height - roundedRadius, roundedRadius, Math.PI, Math.PI * 0.5, true)
    ctx.stroke()

    // Restore context
    ctx.setTransform(transform)

    this.drawSlots(ctx, colorContext, fromSlot, editorAlpha)
  }
}
