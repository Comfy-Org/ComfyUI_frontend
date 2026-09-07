import type { ISelectButtonWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for selecting from a group of buttons
 * This is a widget that only has a Vue widgets implementation
 */
export class SelectButtonWidget
  extends BaseWidget<ISelectButtonWidget>
  implements ISelectButtonWidget
{
  override type = 'selectbutton' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'SelectButton')
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
