import type { IStringWidget, IWidgetOptions } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

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
    width,
    showText = true,
  }: DrawWidgetOptions) {
    // Store original context attributes
    const { fillStyle, strokeStyle, textAlign } = ctx

    this.drawWidgetShape(ctx, { width, showText })

    if (showText) {
      this.drawTruncatingText({ ctx, width, leftPadding: 0, rightPadding: 0 })
    }

    // Restore original context attributes
    Object.assign(ctx, { textAlign, strokeStyle, fillStyle })
  }

  override onClick({ e, node, canvas }: WidgetEventOptions) {
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
