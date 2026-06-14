import { t } from '@/i18n'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'
import { resolveWidgetVisual } from './widgetDraw'

/**
 * Canvas behavior for a widget type, expressed as pure functions over widget
 * data rather than `this`-bound subclass methods. The seam that lets widgets
 * become entities whose behavior lives in systems keyed by `type`.
 */
export interface WidgetBehavior<TWidget extends IBaseWidget = IBaseWidget> {
  drawWidget(
    widget: TWidget,
    ctx: CanvasRenderingContext2D,
    options: DrawWidgetOptions
  ): void
  onClick(widget: TWidget, options: WidgetEventOptions): void
  onDrag?(widget: TWidget, options: WidgetEventOptions): void
}

/** Classic-canvas label shown for each Vue-only widget type. */
const vueOnlyLabels: Record<string, string> = {
  boundingbox: 'BoundingBox',
  chart: 'Chart',
  curve: 'Curve',
  fileupload: 'Fileupload',
  galleria: 'Galleria',
  imagecompare: 'ImageCompare',
  imagecrop: 'ImageCrop',
  markdown: 'Markdown',
  multiselect: 'MultiSelect',
  painter: 'Painter',
  range: 'Range',
  selectbutton: 'SelectButton',
  textarea: 'Textarea',
  treeselect: 'TreeSelect'
}

/**
 * Draws the "Vue only" placeholder shown on the classic canvas for widgets that
 * only have a Vue implementation.
 */
export const vueOnlyWidgetBehavior: WidgetBehavior = {
  drawWidget(widget, ctx, { width }) {
    const { y, height, backgroundColor, outlineColor, textColor } =
      resolveWidgetVisual(widget)
    const label = vueOnlyLabels[widget.type] ?? widget.type

    ctx.save()
    ctx.fillStyle = backgroundColor
    ctx.fillRect(15, y, width - 30, height)

    ctx.strokeStyle = outlineColor
    ctx.strokeRect(15, y, width - 30, height)

    ctx.fillStyle = textColor
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `${label}: ${t('widgets.node2only')}`,
      width / 2,
      y + height / 2
    )
    ctx.restore()
  },
  onClick() {}
}

const widgetBehaviors: Record<string, WidgetBehavior> = Object.fromEntries(
  Object.keys(vueOnlyLabels).map((type) => [type, vueOnlyWidgetBehavior])
)

/** Returns the registered behavior for a widget type, if any. */
export function getWidgetBehavior(type: string): WidgetBehavior | undefined {
  return widgetBehaviors[type]
}
