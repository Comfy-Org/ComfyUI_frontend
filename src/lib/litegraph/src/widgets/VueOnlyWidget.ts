import type { IBaseWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'
import { vueOnlyWidgetBehavior } from './widgetBehavior'

/**
 * Placeholder for widgets that only have a Vue implementation. All real
 * behavior lives in the Vue node render path; on the classic canvas these draw
 * a "Vue only" notice and ignore clicks. A single class covers every Vue-only
 * type, delegating to {@link vueOnlyWidgetBehavior} so the behavior is shared
 * with the type-keyed behavior registry.
 */
export class VueOnlyWidget<
  TWidget extends IBaseWidget = IBaseWidget
> extends BaseWidget<TWidget> {
  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    vueOnlyWidgetBehavior.drawWidget(this, ctx, options)
  }

  onClick(options: WidgetEventOptions): void {
    vueOnlyWidgetBehavior.onClick(this, options)
  }
}
