import type { ICurveWidget } from '@/lib/litegraph/src/types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class CurveWidget
  extends BaseWidget<ICurveWidget>
  implements ICurveWidget
{
  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Curve')
  }

  onClick(_options: WidgetEventOptions): void {}
}
