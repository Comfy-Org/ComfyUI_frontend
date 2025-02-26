import type { INumericWidget, IWidgetOptions } from "@/types/widgets"
import { BaseWidget } from "./BaseWidget"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { LGraphCanvas } from "@/LGraphCanvas"

export class NumberWidget extends BaseWidget implements INumericWidget {
  // INumberWidget properties
  declare type: "number"
  declare value: number
  declare options: IWidgetOptions<number>

  constructor(widget: INumericWidget) {
    super(widget)
    this.type = "number"
    this.value = widget.value
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

    ctx.textAlign = "left"
    ctx.strokeStyle = this.outline_color
    ctx.fillStyle = this.background_color
    ctx.beginPath()

    if (show_text)
      ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5])
    else
      ctx.rect(margin, y, widget_width - margin * 2, H)
    ctx.fill()

    if (show_text) {
      if (!this.disabled) {
        ctx.stroke()
        // Draw left arrow
        ctx.fillStyle = this.text_color
        ctx.beginPath()
        ctx.moveTo(margin + 16, y + 5)
        ctx.lineTo(margin + 6, y + H * 0.5)
        ctx.lineTo(margin + 16, y + H - 5)
        ctx.fill()
        // Draw right arrow
        ctx.beginPath()
        ctx.moveTo(widget_width - margin - 16, y + 5)
        ctx.lineTo(widget_width - margin - 6, y + H * 0.5)
        ctx.lineTo(widget_width - margin - 16, y + H - 5)
        ctx.fill()
      }

      // Draw label
      ctx.fillStyle = this.secondary_text_color
      const label = this.label || this.name
      if (label != null) {
        ctx.fillText(label, margin * 2 + 5, y + H * 0.7)
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
        widget_width - margin * 2 - 20,
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
    const x = e.canvasX - node.pos[0]
    const width = this.width || node.size[0]

    // Determine if clicked on left/right arrows
    const delta = x < 40
      ? -1
      : x > width - 40
        ? 1
        : 0

    if (delta) {
      // Handle left/right arrow clicks
      let newValue = this.value + delta * 0.1 * (this.options.step || 1)
      if (this.options.min != null && newValue < this.options.min) {
        newValue = this.options.min
      }
      if (this.options.max != null && newValue > this.options.max) {
        newValue = this.options.max
      }
      if (newValue !== this.value) {
        this.setValue(newValue, { e, node, canvas })
      }
      return
    }

    // Handle center click - show prompt
    canvas.prompt("Value", this.value, (v: string) => {
      // Check if v is a valid equation or a number
      if (/^[0-9+\-*/()\s]+|\d+\.\d+$/.test(v)) {
        // Solve the equation if possible
        try {
          v = eval(v)
        } catch { }
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
  override onDrag(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    const { e, node, canvas } = options
    const width = this.width || node.width
    const x = e.canvasX - node.pos[0]
    const delta = x < 40
      ? -1
      : x > width - 40
        ? 1
        : 0

    if (delta && (x > -3 && x < width + 3)) return

    let newValue = this.value
    if (e.deltaX) newValue += e.deltaX * 0.1 * (this.options.step || 1)

    if (this.options.min != null && newValue < this.options.min) {
      newValue = this.options.min
    }
    if (this.options.max != null && newValue > this.options.max) {
      newValue = this.options.max
    }
    if (newValue !== this.value) {
      this.setValue(newValue, { e, node, canvas })
    }
  }
}
