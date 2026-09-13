import { st } from '@/i18n'

import type { IBaseWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export abstract class VueOnlyWidget<
  TWidget extends IBaseWidget
> extends BaseWidget<TWidget> {
  protected abstract get vueOnlyLabel(): string

  // fallow-ignore-next-line unused-class-member
  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(
      ctx,
      options,
      st(`widgets.vueOnly.${this.vueOnlyLabel}`, this.vueOnlyLabel)
    )
  }

  // fallow-ignore-next-line unused-class-member
  onClick(_options: WidgetEventOptions): void {}
}
