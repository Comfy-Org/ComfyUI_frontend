import type { IVideoEditWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { WidgetEventOptions } from './BaseWidget'

export class VideoEditWidget
  extends BaseWidget<IVideoEditWidget>
  implements IVideoEditWidget
{
  override type = 'videoedit' as const

  drawWidget(): void {}

  onClick(_options: WidgetEventOptions): void {}
}
