import type { IButtonWidget, IWidgetOptions } from "@/types/widgets"
import { BaseWidget } from "./BaseWidget"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { LGraphCanvas } from "@/LGraphCanvas"

export class ButtonWidget extends BaseWidget implements IButtonWidget {
  // IButtonWidget properties
  declare type: "button"
  declare options: IWidgetOptions<boolean>
  declare clicked: boolean
  declare value: undefined

  constructor(widget: IButtonWidget) {
    super(widget)
    this.type = "button"
    this.clicked = widget.clicked ?? false
  }

  /**
   * Draws the widget
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   */
  override drawWidget(ctx: CanvasRenderingContext2D, options: {
    y: number
    width: number
    show_text?: boolean
    margin?: number
  }) {
    // Store original context attributes
    const originalTextAlign = ctx.textAlign
    const originalStrokeStyle = ctx.strokeStyle
    const originalFillStyle = ctx.fillStyle

    const { y, width, show_text = true, margin = 15 } = options
    const widget_width = width
    const H = this.height

    // Draw button background
    ctx.fillStyle = this.background_color
    if (this.clicked) {
      ctx.fillStyle = "#AAA"
      this.clicked = false
    }
    ctx.fillRect(margin, y, widget_width - margin * 2, H)

    // Draw button outline if not disabled
    if (show_text && !this.disabled) {
      ctx.strokeStyle = this.outline_color
      ctx.strokeRect(margin, y, widget_width - margin * 2, H)
    }

    // Draw button text
    if (show_text) {
      ctx.textAlign = "center"
      ctx.fillStyle = this.text_color
      ctx.fillText(
        this.label || this.name || "",
        widget_width * 0.5,
        y + H * 0.7,
      )
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
    const pos = canvas.graph_mouse

    // Set clicked state and mark canvas as dirty
    this.clicked = true
    canvas.setDirty(true)

    // Call the callback with widget instance and other context
    this.callback?.(this, canvas, node, pos, e)
  }
}
