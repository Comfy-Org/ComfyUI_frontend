import type { IGalleriaWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for displaying image galleries
 * This is a widget that only has a Vue widgets implementation
 */
export class GalleriaWidget
  extends BaseWidget<IGalleriaWidget>
  implements IGalleriaWidget
{
  override type = 'galleria' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Galleria')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
