import type { IChartWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for displaying charts and data visualizations
 * This is a widget that only has a Vue widgets implementation
 */
export class ChartWidget
  extends BaseWidget<IChartWidget>
  implements IChartWidget
{
  override type = 'chart' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Chart')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
