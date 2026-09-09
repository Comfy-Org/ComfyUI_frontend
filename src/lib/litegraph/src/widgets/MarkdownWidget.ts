import type { IMarkdownWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for displaying markdown formatted text
 * This is a widget that only has a Vue widgets implementation
 */
export class MarkdownWidget
  extends BaseWidget<IMarkdownWidget>
  implements IMarkdownWidget
{
  override type = 'markdown' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Markdown')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
