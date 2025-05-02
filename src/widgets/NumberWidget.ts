import type { INumericWidget, IWidgetOptions } from "@/types/widgets"

import { getWidgetStep } from "@/utils/widget"

import { BaseSteppedWidget } from "./BaseSteppedWidget"
import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

export class NumberWidget extends BaseSteppedWidget implements INumericWidget {
  // INumberWidget properties
  declare type: "number"
  declare value: number
  declare options: IWidgetOptions<number>

  constructor(widget: INumericWidget) {
    super(widget)
    this.type = "number"
    this.value = widget.value
  }

  override canIncrement(): boolean {
    const { max } = this.options
    return max == null || this.value < max
  }

  override canDecrement(): boolean {
    const { min } = this.options
    return min == null || this.value > min
  }

  override incrementValue(options: WidgetEventOptions): void {
    this.setValue(this.value + getWidgetStep(this.options), options)
  }

  override decrementValue(options: WidgetEventOptions): void {
    this.setValue(this.value - getWidgetStep(this.options), options)
  }

  override setValue(value: number, options: WidgetEventOptions) {
    let newValue = value
    if (this.options.min != null && newValue < this.options.min) {
      newValue = this.options.min
    }
    if (this.options.max != null && newValue > this.options.max) {
      newValue = this.options.max
    }
    super.setValue(newValue, options)
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

    ctx.textAlign = "left"
    ctx.strokeStyle = this.outline_color
    ctx.fillStyle = this.background_color
    ctx.beginPath()

    if (showText)
      ctx.roundRect(margin, y, width - margin * 2, height, [height * 0.5])
    else
      ctx.rect(margin, y, width - margin * 2, height)
    ctx.fill()

    if (showText) {
      if (!this.computedDisabled) {
        ctx.stroke()
        this.drawArrowButtons(ctx, margin, y, width)
      }

      // Draw label
      ctx.fillStyle = this.secondary_text_color
      const label = this.label || this.name
      if (label != null) {
        ctx.fillText(label, margin * 2 + 5, y + height * 0.7)
      }

      // Draw value
      ctx.fillStyle = this.text_color
      ctx.textAlign = "right"
      ctx.fillText(
        Number(this.value).toFixed(
          this.options.precision !== undefined
            ? this.options.precision
            : 3,
        ),
        width - margin * 2 - 20,
        y + height * 0.7,
      )
    }

    // Restore original context attributes
    ctx.textAlign = originalTextAlign
    ctx.strokeStyle = originalStrokeStyle
    ctx.fillStyle = originalFillStyle
  }

  override onClick({ e, node, canvas }: WidgetEventOptions) {
    const x = e.canvasX - node.pos[0]
    const width = this.width || node.size[0]

    // Determine if clicked on left/right arrows
    const delta = x < 40
      ? -1
      : (x > width - 40
        ? 1
        : 0)

    if (delta) {
      // Handle left/right arrow clicks
      this.setValue(this.value + delta * getWidgetStep(this.options), { e, node, canvas })
      return
    }

    // Handle center click - show prompt
    canvas.prompt("Value", this.value, (v: string) => {
      // Check if v is a valid equation or a number
      if (/^[\d\s()*+/-]+|\d+\.\d+$/.test(v)) {
        // Solve the equation if possible
        try {
          v = eval(v)
        } catch {}
      }
      const newValue = Number(v)
      if (!isNaN(newValue)) {
        this.setValue(newValue, { e, node, canvas })
      }
    }, e)
  }

  /**
   * Handles drag events for the number widget
   * @param options The options for handling the drag event
   */
  override onDrag({ e, node, canvas }: WidgetEventOptions) {
    const width = this.width || node.width
    const x = e.canvasX - node.pos[0]
    const delta = x < 40
      ? -1
      : (x > width - 40
        ? 1
        : 0)

    if (delta && (x > -3 && x < width + 3)) return
    this.setValue(this.value + (e.deltaX ?? 0) * getWidgetStep(this.options), { e, node, canvas })
  }
}
