import type { IButtonWidget, IWidgetOptions } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

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
  override drawWidget(ctx: CanvasRenderingContext2D, {
    width,
    showText = true,
  }: DrawWidgetOptions) {
    // Store original context attributes
    const originalTextAlign = ctx.textAlign
    const originalStrokeStyle = ctx.strokeStyle
    const originalFillStyle = ctx.fillStyle

    const { height, y } = this
    const { margin } = BaseWidget

    // Draw button background
    ctx.fillStyle = this.background_color
    if (this.clicked) {
      ctx.fillStyle = "#AAA"
      this.clicked = false
    }
    ctx.fillRect(margin, y, width - margin * 2, height)

    // Draw button outline if not disabled
    if (showText && !this.computedDisabled) {
      ctx.strokeStyle = this.outline_color
      ctx.strokeRect(margin, y, width - margin * 2, height)
    }

    // Draw button text
    if (showText) {
      ctx.textAlign = "center"
      ctx.fillStyle = this.text_color
      ctx.fillText(
        this.label || this.name || "",
        width * 0.5,
        y + height * 0.7,
      )
    }

    // Restore original context attributes
    ctx.textAlign = originalTextAlign
    ctx.strokeStyle = originalStrokeStyle
    ctx.fillStyle = originalFillStyle
  }

  override onClick({ e, node, canvas }: WidgetEventOptions) {
    const pos = canvas.graph_mouse

    // Set clicked state and mark canvas as dirty
    this.clicked = true
    canvas.setDirty(true)

    // Call the callback with widget instance and other context
    this.callback?.(this, canvas, node, pos, e)
  }
}
