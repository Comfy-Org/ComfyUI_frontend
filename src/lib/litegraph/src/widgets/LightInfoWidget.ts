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

  // fallow-ignore-next-line unused-class-member
  onClick(_options: WidgetEventOptions): void {}
}
