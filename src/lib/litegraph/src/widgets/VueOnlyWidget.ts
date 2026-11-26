import { st } from '@/i18n'

import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

export abstract class VueOnlyWidget<
  TWidget extends IBaseWidget
> extends BaseWidget<TWidget> {
  protected abstract get vueOnlyLabel(): string

  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(
      ctx,
      options,
      st(`widgets.vueOnly.${this.vueOnlyLabel}`, this.vueOnlyLabel)
    )
  }

  onClick(_options: WidgetEventOptions): void {}
}
