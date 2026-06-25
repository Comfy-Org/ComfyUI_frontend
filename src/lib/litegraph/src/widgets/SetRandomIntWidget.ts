import type { ISetRandomIntWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Integer widget with a button to set a random value.
 * This widget only has a Vue implementation.
 */
export class SetRandomIntWidget
  extends BaseWidget<ISetRandomIntWidget>
  implements ISetRandomIntWidget
{
  override type = 'setrandomint' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'SetRandomInt')
  }

  onClick(_options: WidgetEventOptions): void {
    // This widget only has a Vue implementation
  }
}
