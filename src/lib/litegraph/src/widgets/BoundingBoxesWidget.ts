import type { IBoundingBoxesWidget } from '@comfyorg/graph-model/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class BoundingBoxesWidget
  extends BaseWidget<IBoundingBoxesWidget>
  implements IBoundingBoxesWidget
{
  override get value(): IBoundingBoxesWidget['value'] {
    return super.value
  }

  override set value(value: IBoundingBoxesWidget['value']) {
    const maxBoxes = this.options.max_boxes
    super.value =
      maxBoxes !== undefined && Array.isArray(value)
        ? value.slice(0, maxBoxes)
        : value
  }

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Bounding Boxes')
  }

  onClick(_options: WidgetEventOptions): void {}
}
