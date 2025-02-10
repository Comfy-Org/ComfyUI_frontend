import type { ISliderWidget, IWidgetSliderOptions } from "@/types/widgets"
import { BaseWidget } from "./BaseWidget"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { LGraphCanvas } from "@/LGraphCanvas"
import { clamp } from "@/litegraph"

export class SliderWidget extends BaseWidget implements ISliderWidget {
  // ISliderWidget properties
  declare type: "slider"
  declare value: number
  declare options: IWidgetSliderOptions

  constructor(widget: ISliderWidget) {
    super(widget)
    this.type = "slider"
    this.value = widget.value
    this.options = widget.options
  }

  /**
   * Draws the widget
   * @param ctx - The canvas context
   * @param options - The options for drawing the widget
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

    const { y, width: widget_width, show_text = true, margin = 15 } = options
    const H = this.height

    // Draw background
    ctx.fillStyle = this.background_color
    ctx.fillRect(margin, y, widget_width - margin * 2, H)

    // Calculate normalized value
    const range = this.options.max - this.options.min
    let nvalue = (this.value - this.options.min) / range
    nvalue = clamp(nvalue, 0, 1)

    // Draw slider bar
    ctx.fillStyle = this.options.slider_color ?? "#678"
    ctx.fillRect(margin, y, nvalue * (widget_width - margin * 2), H)

    // Draw outline if not disabled
    if (show_text && !this.disabled) {
      ctx.strokeStyle = this.outline_color
      ctx.strokeRect(margin, y, widget_width - margin * 2, H)
    }

    // Draw marker if present
    if (this.marker != null) {
      let marker_nvalue = (this.marker - this.options.min) / range
      marker_nvalue = clamp(marker_nvalue, 0, 1)
      ctx.fillStyle = this.options.marker_color ?? "#AA9"
      ctx.fillRect(
        margin + marker_nvalue * (widget_width - margin * 2),
        y,
        2,
        H,
      )
    }

    // Draw text
    if (show_text) {
      ctx.textAlign = "center"
      ctx.fillStyle = this.text_color
      ctx.fillText(
        (this.label || this.name) +
        "  " +
        Number(this.value).toFixed(
          this.options.precision != null ? this.options.precision : 3,
        ),
        widget_width * 0.5,
        y + H * 0.7,
      )
    }

    // Restore original context attributes
    ctx.textAlign = originalTextAlign
    ctx.strokeStyle = originalStrokeStyle
    ctx.fillStyle = originalFillStyle
  }

  /**
   * Handles click events for the slider widget
   */
  override onClick(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    if (this.options.read_only) return

    const { e, node } = options
    const width = this.width || node.size[0]
    const x = e.canvasX - node.pos[0]

    // Calculate new value based on click position
    const slideFactor = clamp((x - 15) / (width - 30), 0, 1)
    const newValue = this.options.min + (this.options.max - this.options.min) * slideFactor

    if (newValue !== this.value) {
      this.setValue(newValue, options)
    }
  }

  /**
   * Handles drag events for the slider widget
   */
  override onDrag(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    if (this.options.read_only) return false

    const { e, node } = options
    const width = this.width || node.size[0]
    const x = e.canvasX - node.pos[0]

    // Calculate new value based on drag position
    const slideFactor = clamp((x - 15) / (width - 30), 0, 1)
    const newValue = this.options.min + (this.options.max - this.options.min) * slideFactor

    if (newValue !== this.value) {
      this.setValue(newValue, options)
    }
  }
}
