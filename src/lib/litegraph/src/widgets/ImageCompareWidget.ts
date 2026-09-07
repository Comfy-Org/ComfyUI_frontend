import type { IImageCompareWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for comparing two images side by side
 * This is a widget that only has a Vue widgets implementation
 */
export class ImageCompareWidget
  extends BaseWidget<IImageCompareWidget>
  implements IImageCompareWidget
{
  override type = 'imagecompare' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'ImageCompare')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
