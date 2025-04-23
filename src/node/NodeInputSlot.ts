import type { INodeInputSlot, INodeOutputSlot, OptionalProps } from "@/interfaces"
import type { LinkId } from "@/LLink"

import { LabelPosition } from "@/draw"
import { LiteGraph } from "@/litegraph"
import { type IDrawOptions, NodeSlot } from "@/node/NodeSlot"

export class NodeInputSlot extends NodeSlot implements INodeInputSlot {
  link: LinkId | null

  get isWidgetInputSlot(): boolean {
    return !!this.widget
  }

  constructor(slot: OptionalProps<INodeInputSlot, "boundingRect">) {
    super(slot)
    this.link = slot.link
  }

  override isConnected(): boolean {
    return this.link != null
  }

  override isValidTarget(fromSlot: INodeInputSlot | INodeOutputSlot): boolean {
    return "links" in fromSlot && LiteGraph.isValidConnection(this.type, fromSlot.type)
  }

  override draw(ctx: CanvasRenderingContext2D, options: Omit<IDrawOptions, "doStroke" | "labelPosition">) {
    const originalTextAlign = ctx.textAlign
    ctx.textAlign = "left"

    super.draw(ctx, {
      ...options,
      labelPosition: LabelPosition.Right,
      doStroke: false,
    })

    ctx.textAlign = originalTextAlign
  }
}
