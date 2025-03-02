import type { LGraphCanvas } from "@/LGraphCanvas"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { IComboWidget, IWidgetOptions } from "@/types/widgets"

import { LiteGraph } from "@/litegraph"

import { BaseWidget } from "./BaseWidget"

export class ComboWidget extends BaseWidget implements IComboWidget {
  // IComboWidget properties
  declare type: "combo"
  declare value: string | number
  declare options: IWidgetOptions<string>

  constructor(widget: IComboWidget) {
    super(widget)
    this.type = "combo"
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

      let displayValue = typeof this.value === "number" ? String(this.value) : this.value
      if (this.options.values) {
        let values = this.options.values
        if (typeof values === "function") {
          // @ts-expect-error handle () => string[] type that is not typed in IWidgetOptions
          values = values()
        }
        if (values && !Array.isArray(values)) {
          displayValue = values[this.value]
        }
      }

      const labelWidth = ctx.measureText(label || "").width + margin * 2
      const inputWidth = widget_width - margin * 4
      const availableWidth = inputWidth - labelWidth
      const textWidth = ctx.measureText(displayValue).width

      if (textWidth > availableWidth) {
        const ELLIPSIS = "\u2026"
        const ellipsisWidth = ctx.measureText(ELLIPSIS).width
        const charWidthAvg = ctx.measureText("a").width

        if (availableWidth <= ellipsisWidth) {
          // One dot leader
          displayValue = "\u2024"
        } else {
          displayValue = `${displayValue}`
          const overflowWidth = (textWidth + ellipsisWidth) - availableWidth

          // Only first 3 characters need to be measured precisely
          if (overflowWidth + charWidthAvg * 3 > availableWidth) {
            const preciseRange = availableWidth + charWidthAvg * 3
            const preTruncateCt = Math.floor((preciseRange - ellipsisWidth) / charWidthAvg)
            displayValue = displayValue.substr(0, preTruncateCt)
          }

          while (ctx.measureText(displayValue).width + ellipsisWidth > availableWidth) {
            displayValue = displayValue.substr(0, displayValue.length - 1)
          }
          displayValue += ELLIPSIS
        }
      }

      ctx.fillText(
        displayValue,
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
      : (x > width - 40
        ? 1
        : 0)

    // Get values
    let values = this.options.values
    if (typeof values === "function") {
      // @ts-expect-error handle () => string[] type that is not typed in IWidgetOptions
      values = values(this, node)
    }
    // @ts-expect-error Record<string, string> is not typed in IWidgetOptions
    const values_list = Array.isArray(values) ? values : Object.keys(values)

    // Handle left/right arrow clicks
    if (delta) {
      let index = -1
      // avoids double click event
      canvas.last_mouseclick = 0
      index = typeof values === "object"
        ? values_list.indexOf(String(this.value)) + delta
        // @ts-expect-error handle non-string values
        : values_list.indexOf(this.value) + delta

      if (index >= values_list.length) index = values_list.length - 1
      if (index < 0) index = 0

      this.setValue(
        Array.isArray(values)
          ? values[index]
          : index,
        {
          e,
          node,
          canvas,
        },
      )
      return
    }

    // Handle center click - show dropdown menu
    // @ts-expect-error Record<string, string> is not typed in IWidgetOptions
    const text_values = values != values_list ? Object.values(values) : values
    new LiteGraph.ContextMenu(text_values, {
      scale: Math.max(1, canvas.ds.scale),
      event: e,
      className: "dark",
      callback: (value: string) => {
        this.setValue(
          values != values_list
            ? text_values.indexOf(value)
            : value,
          {
            e,
            node,
            canvas,
          },
        )
      },
    })
  }
}
