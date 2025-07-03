import type { INodeInputSlot, INodeOutputSlot, OptionalProps, ReadOnlyPoint } from "@/interfaces"
import type { LGraphNode } from "@/LGraphNode"
import type { LinkId } from "@/LLink"
import type { IBaseWidget } from "@/types/widgets"

import { LabelPosition } from "@/draw"
import { LiteGraph } from "@/litegraph"
import { type IDrawOptions, NodeSlot } from "@/node/NodeSlot"

export class NodeInputSlot extends NodeSlot implements INodeInputSlot {
  link: LinkId | null

  get isWidgetInputSlot(): boolean {
    return !!this.widget
  }

  #widget: WeakRef<IBaseWidget> | undefined

  /** Internal use only; API is not finalised and may change at any time. */
  get _widget(): IBaseWidget | undefined {
    return this.#widget?.deref()
  }

  set _widget(widget: IBaseWidget | undefined) {
    this.#widget = widget ? new WeakRef(widget) : undefined
  }

  get collapsedPos(): ReadOnlyPoint {
    return [0, LiteGraph.NODE_TITLE_HEIGHT * -0.5]
  }

  constructor(slot: OptionalProps<INodeInputSlot, "boundingRect">, node: LGraphNode) {
    super(slot, node)
    this.link = slot.link
  }

  override get isConnected(): boolean {
    return this.link != null
  }

  override isValidTarget(fromSlot: INodeInputSlot | INodeOutputSlot): boolean {
    return "links" in fromSlot && LiteGraph.isValidConnection(this.type, fromSlot.type)
  }

  override draw(ctx: CanvasRenderingContext2D, options: Omit<IDrawOptions, "doStroke" | "labelPosition">) {
    const { textAlign } = ctx
    ctx.textAlign = "left"

    super.draw(ctx, {
      ...options,
      labelPosition: LabelPosition.Right,
      doStroke: false,
    })

    ctx.textAlign = textAlign
  }
}
