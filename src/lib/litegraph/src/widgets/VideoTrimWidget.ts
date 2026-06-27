import type { IVideoTrimWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class VideoTrimWidget
  extends BaseWidget<IVideoTrimWidget>
  implements IVideoTrimWidget
{
  override type = 'videotrim' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, 'Video Trim')
  }

  onClick(_options: WidgetEventOptions): void {}
}
