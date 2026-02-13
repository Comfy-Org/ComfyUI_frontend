import type { IColorCurvesWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

/**
 * Widget for color curves controls.
 * This widget only has a Vue implementation.
 */
export class ColorCurvesWidget
  extends BaseWidget<IColorCurvesWidget>
  implements IColorCurvesWidget
{
  override type = 'colorcurves' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'ColorCurves')
  }

  onClick(_options: WidgetEventOptions): void {
    // This widget only has a Vue implementation
  }
}
