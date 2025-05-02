import type { LGraphNode } from "@/LGraphNode"
import type { IComboWidget, IWidgetOptions } from "@/types/widgets"

import { clamp, LiteGraph } from "@/litegraph"
import { warnDeprecated } from "@/utils/feedback"

import { BaseSteppedWidget } from "./BaseSteppedWidget"
import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

/**
 * This is used as an (invalid) assertion to resolve issues with legacy duck-typed values.
 *
 * Function style in use by:
 * https://github.com/kijai/ComfyUI-KJNodes/blob/c3dc82108a2a86c17094107ead61d63f8c76200e/web/js/setgetnodes.js#L401-L404
 */
type Values = string[] | Record<string, string> | ((widget: ComboWidget, node: LGraphNode) => string[])

function toArray(values: Values): string[] {
  return Array.isArray(values) ? values : Object.keys(values)
}

export class ComboWidget extends BaseSteppedWidget implements IComboWidget {
  // IComboWidget properties
  declare type: "combo"
  declare value: string | number
  // @ts-expect-error Workaround for Record<string, string> not being typed in IWidgetOptions
  declare options: Omit<IWidgetOptions<string>, "values"> & { values: Values }

  constructor(widget: IComboWidget) {
    super(widget)
    this.type = "combo"
    this.value = widget.value
  }

  #getValues(node: LGraphNode): Values {
    const { values } = this.options
    if (values == null) throw new Error("[ComboWidget]: values is required")

    return typeof values === "function"
      ? values(this, node)
      : values
  }

  /**
   * Checks if the value is {@link Array.at at} the given index in the combo list.
   * @param increment `true` if checking the use of the increment button, `false` for decrement
   * @returns `true` if the value is at the given index, otherwise `false`.
   */
  #canUseButton(increment: boolean): boolean {
    const { values } = this.options
    // If using legacy duck-typed method, false is the most permissive return value
    if (typeof values === "function") return false

    const valuesArray = toArray(values)
    if (!(valuesArray.length > 1)) return false

    // Edge case where the value is both the first and last item in the list
    const firstValue = valuesArray.at(0)
    const lastValue = valuesArray.at(-1)
    if (firstValue === lastValue) return true

    return this.value !== (increment ? lastValue : firstValue)
  }

  /**
   * Returns `true` if the current value is not the last value in the list.
   * Handles edge case where the value is both the first and last item in the list.
   */
  override canIncrement(): boolean {
    return this.#canUseButton(true)
  }

  override canDecrement(): boolean {
    return this.#canUseButton(false)
  }

  override incrementValue(options: WidgetEventOptions): void {
    this.#tryChangeValue(1, options)
  }

  override decrementValue(options: WidgetEventOptions): void {
    this.#tryChangeValue(-1, options)
  }

  #tryChangeValue(delta: number, options: WidgetEventOptions): void {
    const values = this.#getValues(options.node)
    const indexedValues = toArray(values)

    // avoids double click event
    options.canvas.last_mouseclick = 0

    const foundIndex = typeof values === "object"
      ? indexedValues.indexOf(String(this.value)) + delta
      // @ts-expect-error handle non-string values
      : indexedValues.indexOf(this.value) + delta

    const index = clamp(foundIndex, 0, indexedValues.length - 1)

    const value = Array.isArray(values)
      ? values[index]
      : index
    this.setValue(value, options)
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
      const inputWidth = width - margin * 4
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

    // Deprecated functionality (warning as of v0.14.5)
    if (typeof this.options.values === "function") {
      warnDeprecated("Using a function for values is deprecated. Use an array of unique values instead.")
    }

    // Determine if clicked on left/right arrows
    if (x < 40) return this.decrementValue({ e, node, canvas })
    if (x > width - 40) return this.incrementValue({ e, node, canvas })

    // Otherwise, show dropdown menu
    const values = this.#getValues(node)
    const values_list = toArray(values)

    // Handle center click - show dropdown menu
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
          { e, node, canvas },
        )
      },
    })
  }
}
