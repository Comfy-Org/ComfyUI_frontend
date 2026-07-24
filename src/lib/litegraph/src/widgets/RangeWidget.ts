import type { IRangeWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class RangeWidget
  extends BaseWidget<IRangeWidget>
  implements IRangeWidget
{
  override type = 'range' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Range')
  }

  onClick(_options: WidgetEventOptions): void {}
}
