import type { IColorsWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class ColorsWidget
  extends BaseWidget<IColorsWidget>
  implements IColorsWidget
{
  override type = 'colors' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Colors')
  }

  onClick(_options: WidgetEventOptions): void {}
}
