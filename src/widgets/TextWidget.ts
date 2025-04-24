import type { LGraphCanvas } from "@/LGraphCanvas"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { IStringWidget, IWidgetOptions } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions } from "./BaseWidget"

export class TextWidget extends BaseWidget implements IStringWidget {
  // IStringWidget properties
  declare type: "text" | "string"
  declare value: string
  declare options: IWidgetOptions<string>

  constructor(widget: IStringWidget) {
    super(widget)
    this.type = widget.type ?? "string"
    this.value = widget.value?.toString() ?? ""
  }

  /**
   * Draws the widget
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   */
  override drawWidget(ctx: CanvasRenderingContext2D, {
    y,
    width,
    show_text = true,
    margin = BaseWidget.margin,
  }: DrawWidgetOptions) {
    // Store original context attributes
    const originalTextAlign = ctx.textAlign
    const originalStrokeStyle = ctx.strokeStyle
    const originalFillStyle = ctx.fillStyle

    const { height } = this

    ctx.textAlign = "left"
    ctx.strokeStyle = this.outline_color
    ctx.fillStyle = this.background_color
    ctx.beginPath()

    if (show_text)
      ctx.roundRect(margin, y, width - margin * 2, height, [height * 0.5])
    else
      ctx.rect(margin, y, width - margin * 2, height)
    ctx.fill()

    if (show_text) {
      if (!this.computedDisabled) ctx.stroke()
      ctx.save()
      ctx.beginPath()
      ctx.rect(margin, y, width - margin * 2, height)
      ctx.clip()

      // Draw label
      ctx.fillStyle = this.secondary_text_color
      const label = this.label || this.name
      if (label != null) {
        ctx.fillText(label, margin * 2, y + height * 0.7)
      }

      // Draw value
      ctx.fillStyle = this.text_color
      ctx.textAlign = "right"
      ctx.fillText(
        // 30 chars max
        String(this.value).substr(0, 30),
        width - margin * 2,
        y + height * 0.7,
      )
      ctx.restore()
    }

    // Restore original context attributes
    ctx.textAlign = originalTextAlign
    ctx.strokeStyle = originalStrokeStyle
    ctx.fillStyle = originalFillStyle
  }

  override onClick(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    const { e, node, canvas } = options

    // Show prompt dialog for text input
    canvas.prompt(
      "Value",
      this.value,
      (v: string) => {
        if (v !== null) {
          this.setValue(v, { e, node, canvas })
        }
      },
      e,
      this.options?.multiline ?? false,
    )
  }
}
