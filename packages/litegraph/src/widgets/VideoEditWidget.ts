import type { IVideoEditWidget } from '@comfyorg/graph-model/widgets'
import { BaseWidget } from './BaseWidget'
import type { WidgetEventOptions } from './BaseWidget'

export class VideoEditWidget
  extends BaseWidget<IVideoEditWidget>
  implements IVideoEditWidget
{
  drawWidget(): void {}

  onClick(_options: WidgetEventOptions): void {}
}
