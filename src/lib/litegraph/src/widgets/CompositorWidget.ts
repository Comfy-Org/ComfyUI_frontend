import type { ICompositorWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for the ImageCompositor node preview and editor launcher.
 * This is a widget that only has a Vue widgets implementation.
 */
export class CompositorWidget
  extends BaseWidget<ICompositorWidget>
  implements ICompositorWidget
{
  override type = 'compositor' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Compositor')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
