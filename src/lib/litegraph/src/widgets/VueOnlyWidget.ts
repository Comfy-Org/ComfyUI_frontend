import type { IBaseWidget } from '../types/widgets'
import { BaseWidget } from './BaseWidget'
import type { DrawWidgetOptions, WidgetEventOptions } from './BaseWidget'

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
 * Placeholder for widgets that only have a Vue implementation. All real
 * behavior lives in the Vue node render path; on the classic canvas these draw
 * a "Vue only" notice and ignore clicks. A single class covers every Vue-only
 * type — they carry no canvas behavior, only a `type` discriminant.
 */
export class VueOnlyWidget<
  TWidget extends IBaseWidget = IBaseWidget
> extends BaseWidget<TWidget> {
  drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions): void {
    this.drawVueOnlyWarning(ctx, options, vueOnlyLabels[this.type] ?? this.type)
  }

  onClick(_options: WidgetEventOptions): void {}
}
