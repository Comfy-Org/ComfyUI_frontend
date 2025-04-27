import type { IBooleanWidget } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

export class BooleanWidget extends BaseWidget implements IBooleanWidget {
  // IBooleanWidget properties
  declare type: "toggle"
  declare value: boolean

  constructor(widget: IBooleanWidget) {
    super(widget)
    this.type = "toggle"
    this.value = widget.value
  }

  override drawWidget(ctx: CanvasRenderingContext2D, {
    y,
    width,
    show_text = true,
    margin = BaseWidget.margin,
  }: DrawWidgetOptions) {
    const { height } = this

    ctx.textAlign = "left"
    ctx.strokeStyle = this.outline_color
    ctx.fillStyle = this.background_color
    ctx.beginPath()

    if (show_text)
      ctx.roundRect(margin, y, width - margin * 2, height, [height * 0.5])
    else ctx.rect(margin, y, width - margin * 2, height)
    ctx.fill()
    if (show_text && !this.computedDisabled) ctx.stroke()
    ctx.fillStyle = this.value ? "#89A" : "#333"
    ctx.beginPath()
    ctx.arc(
      width - margin * 2,
      y + height * 0.5,
      height * 0.36,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    if (show_text) {
      ctx.fillStyle = this.secondary_text_color
      const label = this.label || this.name
      if (label != null) {
        ctx.fillText(label, margin * 2, y + height * 0.7)
      }
      ctx.fillStyle = this.value ? this.text_color : this.secondary_text_color
      ctx.textAlign = "right"
      ctx.fillText(
        this.value ? this.options.on || "true" : this.options.off || "false",
        width - 40,
        y + height * 0.7,
      )
    }
  }

  override onClick(options: WidgetEventOptions) {
    this.setValue(!this.value, options)
  }
}
