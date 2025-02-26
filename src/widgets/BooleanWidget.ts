import type { LGraphCanvas } from "@/LGraphCanvas"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { IBooleanWidget } from "@/types/widgets"

import { BaseWidget } from "./BaseWidget"

export class BooleanWidget extends BaseWidget implements IBooleanWidget {
  // IBooleanWidget properties
  declare type: "toggle"
  declare value: boolean

  constructor(widget: IBooleanWidget) {
    super(widget)
    this.type = "toggle"
    this.value = widget.value
  }

  override drawWidget(ctx: CanvasRenderingContext2D, options: {
    y: number
    width: number
    show_text?: boolean
    margin?: number
  }) {
    const { y, width, show_text = true, margin = 15 } = options
    const widget_width = width
    const H = this.height

    ctx.textAlign = "left"
    ctx.strokeStyle = this.outline_color
    ctx.fillStyle = this.background_color
    ctx.beginPath()

    if (show_text)
      ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5])
    else ctx.rect(margin, y, widget_width - margin * 2, H)
    ctx.fill()
    if (show_text && !this.disabled) ctx.stroke()
    ctx.fillStyle = this.value ? "#89A" : "#333"
    ctx.beginPath()
    ctx.arc(
      widget_width - margin * 2,
      y + H * 0.5,
      H * 0.36,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    if (show_text) {
      ctx.fillStyle = this.secondary_text_color
      const label = this.label || this.name
      if (label != null) {
        ctx.fillText(label, margin * 2, y + H * 0.7)
      }
      ctx.fillStyle = this.value ? this.text_color : this.secondary_text_color
      ctx.textAlign = "right"
      ctx.fillText(
        this.value ? this.options.on || "true" : this.options.off || "false",
        widget_width - 40,
        y + H * 0.7,
      )
    }
  }

  override onClick(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    this.setValue(!this.value, options)
  }
}
