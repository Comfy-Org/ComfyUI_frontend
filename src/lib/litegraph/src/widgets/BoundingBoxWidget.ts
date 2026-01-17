import { t } from '@/i18n'

import type { IBoundingBoxWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export class BoundingBoxWidget
  extends BaseWidget<IBoundingBoxWidget>
  implements IBoundingBoxWidget
{
  override type = 'boundingbox' as const

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    const { width } = options
    const { y, height } = this

    ctx.save()

    ctx.fillStyle = this.background_color
    ctx.fillRect(15, y, width - 30, height)

    ctx.strokeStyle = this.outline_color
    ctx.strokeRect(15, y, width - 30, height)

    ctx.fillStyle = this.text_color
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const text = `BoundingBox: ${t('widgets.node2only')}`
    ctx.fillText(text, width / 2, y + height / 2)

    ctx.restore()
  }

  onClick(_options: WidgetEventOptions): void {
    // This is a widget that only has a Vue widgets implementation
  }
}
