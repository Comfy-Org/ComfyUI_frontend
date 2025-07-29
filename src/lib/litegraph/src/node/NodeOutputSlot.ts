import type { INodeInputSlot, INodeOutputSlot, OptionalProps, ReadOnlyPoint } from '../interfaces'
import type { LGraphNode } from '../LGraphNode'
import type { LinkId } from '../LLink'

import { LabelPosition } from '../draw'
import { LiteGraph } from '../litegraph'
import { type IDrawOptions, NodeSlot } from './NodeSlot'

export class NodeOutputSlot extends NodeSlot implements INodeOutputSlot {
  #node: LGraphNode

  links: LinkId[] | null
  _data?: unknown
  slot_index?: number

  get isWidgetInputSlot(): false {
    return false
  }

  get collapsedPos(): ReadOnlyPoint {
    return [
      this.#node._collapsed_width ?? LiteGraph.NODE_COLLAPSED_WIDTH,
      LiteGraph.NODE_TITLE_HEIGHT * -0.5,
    ]
  }

  constructor(slot: OptionalProps<INodeOutputSlot, "boundingRect">, node: LGraphNode) {
    super(slot, node)
    this.links = slot.links
    this._data = slot._data
    this.slot_index = slot.slot_index
    this.#node = node
  }

  override isValidTarget(fromSlot: INodeInputSlot | INodeOutputSlot): boolean {
    return "link" in fromSlot && LiteGraph.isValidConnection(this.type, fromSlot.type)
  }

  override get isConnected(): boolean {
    return this.links != null && this.links.length > 0
  }

  override draw(ctx: CanvasRenderingContext2D, options: Omit<IDrawOptions, "doStroke" | "labelPosition">) {
    const { textAlign, strokeStyle } = ctx
    ctx.textAlign = "right"
    ctx.strokeStyle = "black"

    super.draw(ctx, {
      ...options,
      labelPosition: LabelPosition.Left,
      doStroke: true,
    })

    ctx.textAlign = textAlign
    ctx.strokeStyle = strokeStyle
  }
}
