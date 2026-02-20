import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IPasswordWidget } from '@/lib/litegraph/src/types/widgets'

import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class PasswordWidget
  extends BaseWidget<IPasswordWidget>
  implements IPasswordWidget
{
  constructor(widget: IPasswordWidget, node: LGraphNode) {
    super(widget, node)
    this.type ??= 'password'
    this.value = widget.value?.toString() ?? ''
  }

  override get _displayValue(): string {
    if (this.computedDisabled || !this.value) return ''
    return '\u2022'.repeat(Math.min(this.value.length, 20))
  }

  override drawWidget(
    ctx: CanvasRenderingContext2D,
    { width, showText = true }: DrawWidgetOptions
  ) {
    const { fillStyle, strokeStyle, textAlign } = ctx

    this.drawWidgetShape(ctx, { width, showText })

    if (showText) {
      this.drawTruncatingText({ ctx, width, leftPadding: 0, rightPadding: 0 })
    }

    Object.assign(ctx, { textAlign, strokeStyle, fillStyle })
  }

  override onClick({ e, node, canvas }: WidgetEventOptions) {
    canvas.prompt(
      'Value',
      this.value,
      (v: string) => {
        if (v !== null) {
          this.setValue(v, { e, node, canvas })
        }
      },
      e,
      false
    )
  }
}
