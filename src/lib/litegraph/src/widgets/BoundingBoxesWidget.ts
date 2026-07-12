import type { IBoundingBoxesWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class BoundingBoxesWidget
  extends BaseWidget<IBoundingBoxesWidget>
  implements IBoundingBoxesWidget
{
  override type = 'boundingboxes' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Bounding Boxes')
  }

  onClick(_options: WidgetEventOptions): void {}
}
