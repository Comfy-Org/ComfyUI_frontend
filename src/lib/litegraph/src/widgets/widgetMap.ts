import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IAssetWidget,
  IBaseWidget,
  IBoundingBoxWidget,
  IChartWidget,
  IComboWidget,
  ICurveWidget,
  IFileUploadWidget,
  IGalleriaWidget,
  IImageCompareWidget,
  IImageCropWidget,
  IMarkdownWidget,
  IMultiSelectWidget,
  IPainterWidget,
  IRangeWidget,
  ISelectButtonWidget,
  ITextareaWidget,
  ITreeSelectWidget,
  IWidget,
  TWidgetType
} from '@/lib/litegraph/src/types/widgets'
import { toClass } from '@/lib/litegraph/src/utils/type'

import { AssetWidget } from './AssetWidget'
import { BaseWidget } from './BaseWidget'
import { BooleanWidget } from './BooleanWidget'
import { ButtonWidget } from './ButtonWidget'
import { ColorWidget } from './ColorWidget'
import { ComboWidget } from './ComboWidget'
import { GradientSliderWidget } from './GradientSliderWidget'
import { KnobWidget } from './KnobWidget'
import { LegacyWidget } from './LegacyWidget'
import { NumberWidget } from './NumberWidget'
import { SliderWidget } from './SliderWidget'
import { TextWidget } from './TextWidget'
import { VueOnlyWidget } from './VueOnlyWidget'

export type WidgetTypeMap = {
  button: ButtonWidget
  toggle: BooleanWidget
  slider: SliderWidget
  gradientslider: GradientSliderWidget
  knob: KnobWidget
  combo: ComboWidget
  number: NumberWidget
  string: TextWidget
  text: TextWidget
  custom: LegacyWidget
  fileupload: VueOnlyWidget<IFileUploadWidget>
  color: ColorWidget
  markdown: VueOnlyWidget<IMarkdownWidget>
  treeselect: VueOnlyWidget<ITreeSelectWidget>
  multiselect: VueOnlyWidget<IMultiSelectWidget>
  chart: VueOnlyWidget<IChartWidget>
  galleria: VueOnlyWidget<IGalleriaWidget>
  imagecompare: VueOnlyWidget<IImageCompareWidget>
  selectbutton: VueOnlyWidget<ISelectButtonWidget>
  textarea: VueOnlyWidget<ITextareaWidget>
  asset: AssetWidget
  imagecrop: VueOnlyWidget<IImageCropWidget>
  boundingbox: VueOnlyWidget<IBoundingBoxWidget>
  curve: VueOnlyWidget<ICurveWidget>
  painter: VueOnlyWidget<IPainterWidget>
  range: VueOnlyWidget<IRangeWidget>
  [key: string]: BaseWidget
}

/**
 * Convert a widget POJO to a proper widget instance.
 * @param widget The POJO to convert.
 * @param node The node the widget belongs to.
 * @param wrapLegacyWidgets Whether to wrap legacy widgets in a `LegacyWidget` instance.
 * @returns A concrete widget instance.
 */
export function toConcreteWidget<TWidget extends IWidget | IBaseWidget>(
  widget: TWidget,
  node: LGraphNode,
  wrapLegacyWidgets?: true
): WidgetTypeMap[TWidget['type']]
export function toConcreteWidget<TWidget extends IWidget | IBaseWidget>(
  widget: TWidget,
  node: LGraphNode,
  wrapLegacyWidgets: false
): WidgetTypeMap[TWidget['type']] | undefined
export function toConcreteWidget<TWidget extends IWidget | IBaseWidget>(
  widget: TWidget,
  node: LGraphNode,
  wrapLegacyWidgets = true
): WidgetTypeMap[TWidget['type']] | undefined {
  if (widget instanceof BaseWidget) return widget

  // Assertion: TypeScript has no concept of "all strings except X"
  type RemoveBaseWidgetType<T> = T extends { type: TWidgetType } ? T : never
  const narrowedWidget = widget as RemoveBaseWidgetType<TWidget>

  switch (narrowedWidget.type) {
    case 'button':
      return toClass(ButtonWidget, narrowedWidget, node)
    case 'toggle':
      return toClass(BooleanWidget, narrowedWidget, node)
    case 'slider':
      return toClass(SliderWidget, narrowedWidget, node)
    case 'gradientslider':
      return toClass(GradientSliderWidget, narrowedWidget, node)
    case 'knob':
      return toClass(KnobWidget, narrowedWidget, node)
    case 'combo':
      return toClass(ComboWidget, narrowedWidget, node)
    case 'number':
      return toClass(NumberWidget, narrowedWidget, node)
    case 'string':
      return toClass(TextWidget, narrowedWidget, node)
    case 'text':
      return toClass(TextWidget, narrowedWidget, node)
    case 'color':
      return toClass(ColorWidget, narrowedWidget, node)
    case 'asset':
      return toClass(AssetWidget, narrowedWidget, node)
    case 'fileupload':
    case 'markdown':
    case 'treeselect':
    case 'multiselect':
    case 'chart':
    case 'galleria':
    case 'imagecompare':
    case 'selectbutton':
    case 'textarea':
    case 'imagecrop':
    case 'boundingbox':
    case 'curve':
    case 'painter':
    case 'range':
      return toClass(VueOnlyWidget, narrowedWidget, node)
    default: {
      if (wrapLegacyWidgets) return toClass(LegacyWidget, widget, node)
    }
  }
}

// #region Type Guards

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IComboWidget}. */
export function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/**
 * Type guard: Narrow **from {@link IBaseWidget}** to {@link IAssetWidget}.
 * @knipIgnoreUnusedButUsedByCustomNodes
 */
export function isAssetWidget(widget: IBaseWidget): widget is IAssetWidget {
  return widget.type === 'asset'
}

// #endregion Type Guards
