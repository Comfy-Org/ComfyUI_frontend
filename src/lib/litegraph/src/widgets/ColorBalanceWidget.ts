import type { IColorBalanceWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for color balance controls.
 * This widget only has a Vue implementation.
 */
export class ColorBalanceWidget
  extends BaseWidget<IColorBalanceWidget>
  implements IColorBalanceWidget
{
  override type = 'colorbalance' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'ColorBalance')
  }

  onClick(_options: WidgetEventOptions): void {
    // This widget only has a Vue implementation
  }
}
