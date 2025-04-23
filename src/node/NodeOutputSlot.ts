import type { INodeInputSlot, INodeOutputSlot, OptionalProps } from "@/interfaces"
import type { LinkId } from "@/LLink"

import { LabelPosition } from "@/draw"
import { LiteGraph } from "@/litegraph"
import { type IDrawOptions, NodeSlot } from "@/node/NodeSlot"

export class NodeOutputSlot extends NodeSlot implements INodeOutputSlot {
  links: LinkId[] | null
  _data?: unknown
  slot_index?: number

  get isWidgetInputSlot(): false {
    return false
  }

  constructor(slot: OptionalProps<INodeOutputSlot, "boundingRect">) {
    super(slot)
    this.links = slot.links
    this._data = slot._data
    this.slot_index = slot.slot_index
  }

  override isValidTarget(fromSlot: INodeInputSlot | INodeOutputSlot): boolean {
    return "link" in fromSlot && LiteGraph.isValidConnection(this.type, fromSlot.type)
  }

  override isConnected(): boolean {
    return this.links != null && this.links.length > 0
  }

  override draw(ctx: CanvasRenderingContext2D, options: Omit<IDrawOptions, "doStroke" | "labelPosition">) {
    const originalTextAlign = ctx.textAlign
    const originalStrokeStyle = ctx.strokeStyle
    ctx.textAlign = "right"
    ctx.strokeStyle = "black"

    super.draw(ctx, {
      ...options,
      labelPosition: LabelPosition.Left,
      doStroke: true,
    })

    ctx.textAlign = originalTextAlign
    ctx.strokeStyle = originalStrokeStyle
  }
}
