import type { ILightInfoWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class LightInfoWidget
  extends BaseWidget<ILightInfoWidget>
  implements ILightInfoWidget
{
  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Light Info')
  }

  onClick(_options: WidgetEventOptions): void {}
}
