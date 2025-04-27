import type { ISliderWidget, IWidgetSliderOptions } from "@/types/widgets"

import { clamp } from "@/litegraph"

import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

export class SliderWidget extends BaseWidget implements ISliderWidget {
  // ISliderWidget properties
  declare type: "slider"
  declare value: number
  declare options: IWidgetSliderOptions
  marker?: number

  constructor(widget: ISliderWidget) {
    super(widget)
    this.type = "slider"
    this.value = widget.value
    this.options = widget.options
    this.marker = widget.marker
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

    // Draw background
    ctx.fillStyle = this.background_color
    ctx.fillRect(margin, y, width - margin * 2, height)

    // Calculate normalized value
    const range = this.options.max - this.options.min
    let nvalue = (this.value - this.options.min) / range
    nvalue = clamp(nvalue, 0, 1)

    // Draw slider bar
    ctx.fillStyle = this.options.slider_color ?? "#678"
    ctx.fillRect(margin, y, nvalue * (width - margin * 2), height)

    // Draw outline if not disabled
    if (show_text && !this.computedDisabled) {
      ctx.strokeStyle = this.outline_color
      ctx.strokeRect(margin, y, width - margin * 2, height)
    }

    // Draw marker if present
    if (this.marker != null) {
      let marker_nvalue = (this.marker - this.options.min) / range
      marker_nvalue = clamp(marker_nvalue, 0, 1)
      ctx.fillStyle = this.options.marker_color ?? "#AA9"
      ctx.fillRect(
        margin + marker_nvalue * (width - margin * 2),
        y,
        2,
        height,
      )
    }

    // Draw text
    if (show_text) {
      ctx.textAlign = "center"
      ctx.fillStyle = this.text_color
      const fixedValue = Number(this.value).toFixed(this.options.precision ?? 3)
      ctx.fillText(
        `${this.label || this.name}  ${fixedValue}`,
        width * 0.5,
        y + height * 0.7,
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
  override onClick(options: WidgetEventOptions) {
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
  override onDrag(options: WidgetEventOptions) {
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
