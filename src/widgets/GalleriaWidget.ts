import type { IGalleriaWidget } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

/**
 * Widget for displaying image galleries
 * This is a widget that only has a Vue widgets implementation
 */
export class GalleriaWidget extends BaseWidget<IGalleriaWidget> implements IGalleriaWidget {
  override type = "galleria" as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    const { width } = options
    const { y, height } = this

    const { fillStyle, strokeStyle, textAlign, textBaseline, font } = ctx

    ctx.fillStyle = this.background_color
    ctx.fillRect(15, y, width - 30, height)

    ctx.strokeStyle = this.outline_color
    ctx.strokeRect(15, y, width - 30, height)

    ctx.fillStyle = this.text_color
    ctx.font = "11px monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    const text = "Galleria: Vue-only"
    ctx.fillText(text, width / 2, y + height / 2)

    Object.assign(ctx, { fillStyle, strokeStyle, textAlign, textBaseline, font })
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
