import type { IMultiSelectWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for selecting multiple options
 * This is a widget that only has a Vue widgets implementation
 */
export class MultiSelectWidget
  extends BaseWidget<IMultiSelectWidget>
  implements IMultiSelectWidget
{
  override type = 'multiselect' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'MultiSelect')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
