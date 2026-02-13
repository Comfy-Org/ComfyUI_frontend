import type { IColorCorrectWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for color correction controls.
 * This widget only has a Vue implementation.
 */
export class ColorCorrectWidget
  extends BaseWidget<IColorCorrectWidget>
  implements IColorCorrectWidget
{
  override type = 'colorcorrect' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'ColorCorrect')
  }

  onClick(_options: WidgetEventOptions): void {
    // This widget only has a Vue implementation
  }
}
