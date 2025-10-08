import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IButtonWidget } from '@/lib/litegraph/src/types/widgets'

import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions } from './BaseWidget'

class DisconnectedWidget extends BaseWidget<IButtonWidget> {
  constructor(widget: IButtonWidget) {
    super(widget, new LGraphNode('DisconnectedPlaceholder'))
    this.disabled = true
  }

  override drawWidget(
    ctx: CanvasRenderingContext2D,
    { width, showText = true }: DrawWidgetOptions
  ) {
    ctx.save()
    this.drawWidgetShape(ctx, { width, showText })
    if (showText) {
      this.drawTruncatingText({ ctx, width, leftPadding: 0, rightPadding: 0 })
    }
    ctx.restore()
  }

  override onClick() {}

  override get _displayValue() {
    return 'Disconnected'
  }
}
const conf: IButtonWidget = {
  type: 'button',
  value: undefined,
  name: 'Disconnected',
  options: {},
  y: 0,
  clicked: false
}
export const disconnectedWidget = new DisconnectedWidget(conf)
