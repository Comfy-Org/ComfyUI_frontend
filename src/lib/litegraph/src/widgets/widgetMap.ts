import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IBooleanWidget,
  IButtonWidget,
  IChartWidget,
  IColorWidget,
  IComboWidget,
  ICustomWidget,
  IFileUploadWidget,
  IGalleriaWidget,
  IImageCompareWidget,
  IImageWidget,
  IKnobWidget,
  IMarkdownWidget,
  IMultiSelectWidget,
  INumericWidget,
  ISelectButtonWidget,
  ISliderWidget,
  IStringWidget,
  ITextareaWidget,
  ITreeSelectWidget,
  IWidget,
  TWidgetType
} from '@/lib/litegraph/src/types/widgets'
import { toClass } from '@/lib/litegraph/src/utils/type'

import { BaseWidget } from './BaseWidget'
import { BooleanWidget } from './BooleanWidget'
import { ButtonWidget } from './ButtonWidget'
import { ChartWidget } from './ChartWidget'
import { ColorWidget } from './ColorWidget'
import { ComboWidget } from './ComboWidget'
import { FileUploadWidget } from './FileUploadWidget'
import { GalleriaWidget } from './GalleriaWidget'
import { ImageCompareWidget } from './ImageCompareWidget'
import { ImageWidget } from './ImageWidget'
import { KnobWidget } from './KnobWidget'
import { LegacyWidget } from './LegacyWidget'
import { MarkdownWidget } from './MarkdownWidget'
import { MultiSelectWidget } from './MultiSelectWidget'
import { NumberWidget } from './NumberWidget'
import { SelectButtonWidget } from './SelectButtonWidget'
import { SliderWidget } from './SliderWidget'
import { TextWidget } from './TextWidget'
import { TextareaWidget } from './TextareaWidget'
import { TreeSelectWidget } from './TreeSelectWidget'

export type WidgetTypeMap = {
  button: ButtonWidget
  toggle: BooleanWidget
  slider: SliderWidget
  knob: KnobWidget
  combo: ComboWidget
  number: NumberWidget
  string: TextWidget
  text: TextWidget
  custom: LegacyWidget
  fileupload: FileUploadWidget
  color: ColorWidget
  markdown: MarkdownWidget
  image: ImageWidget
  treeselect: TreeSelectWidget
  multiselect: MultiSelectWidget
  chart: ChartWidget
  galleria: GalleriaWidget
  imagecompare: ImageCompareWidget
  selectbutton: SelectButtonWidget
  textarea: TextareaWidget
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
    case 'fileupload':
      return toClass(FileUploadWidget, narrowedWidget, node)
    case 'color':
      return toClass(ColorWidget, narrowedWidget, node)
    case 'markdown':
      return toClass(MarkdownWidget, narrowedWidget, node)
    case 'image':
      return toClass(ImageWidget, narrowedWidget, node)
    case 'treeselect':
      return toClass(TreeSelectWidget, narrowedWidget, node)
    case 'multiselect':
      return toClass(MultiSelectWidget, narrowedWidget, node)
    case 'chart':
      return toClass(ChartWidget, narrowedWidget, node)
    case 'galleria':
      return toClass(GalleriaWidget, narrowedWidget, node)
    case 'imagecompare':
      return toClass(ImageCompareWidget, narrowedWidget, node)
    case 'selectbutton':
      return toClass(SelectButtonWidget, narrowedWidget, node)
    case 'textarea':
      return toClass(TextareaWidget, narrowedWidget, node)
    default: {
      if (wrapLegacyWidgets) return toClass(LegacyWidget, widget, node)
    }
  }
}

// #region Type Guards

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IButtonWidget}. */
export function isButtonWidget(widget: IBaseWidget): widget is IButtonWidget {
  return widget.type === 'button'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IBooleanWidget}. */
export function isBooleanWidget(widget: IBaseWidget): widget is IBooleanWidget {
  return widget.type === 'toggle'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ISliderWidget}. */
export function isSliderWidget(widget: IBaseWidget): widget is ISliderWidget {
  return widget.type === 'slider'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IKnobWidget}. */
export function isKnobWidget(widget: IBaseWidget): widget is IKnobWidget {
  return widget.type === 'knob'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IComboWidget}. */
export function isComboWidget(widget: IBaseWidget): widget is IComboWidget {
  return widget.type === 'combo'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link INumericWidget}. */
export function isNumberWidget(widget: IBaseWidget): widget is INumericWidget {
  return widget.type === 'number'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IStringWidget}. */
export function isStringWidget(widget: IBaseWidget): widget is IStringWidget {
  return widget.type === 'string'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ITextWidget}. */
export function isTextWidget(widget: IBaseWidget): widget is IStringWidget {
  return widget.type === 'text'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ICustomWidget}. */
export function isCustomWidget(widget: IBaseWidget): widget is ICustomWidget {
  return widget.type === 'custom'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IFileUploadWidget}. */
export function isFileUploadWidget(
  widget: IBaseWidget
): widget is IFileUploadWidget {
  return widget.type === 'fileupload'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IColorWidget}. */
export function isColorWidget(widget: IBaseWidget): widget is IColorWidget {
  return widget.type === 'color'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IMarkdownWidget}. */
export function isMarkdownWidget(
  widget: IBaseWidget
): widget is IMarkdownWidget {
  return widget.type === 'markdown'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IImageWidget}. */
export function isImageWidget(widget: IBaseWidget): widget is IImageWidget {
  return widget.type === 'image'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ITreeSelectWidget}. */
export function isTreeSelectWidget(
  widget: IBaseWidget
): widget is ITreeSelectWidget {
  return widget.type === 'treeselect'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IMultiSelectWidget}. */
export function isMultiSelectWidget(
  widget: IBaseWidget
): widget is IMultiSelectWidget {
  return widget.type === 'multiselect'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IChartWidget}. */
export function isChartWidget(widget: IBaseWidget): widget is IChartWidget {
  return widget.type === 'chart'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IGalleriaWidget}. */
export function isGalleriaWidget(
  widget: IBaseWidget
): widget is IGalleriaWidget {
  return widget.type === 'galleria'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link IImageCompareWidget}. */
export function isImageCompareWidget(
  widget: IBaseWidget
): widget is IImageCompareWidget {
  return widget.type === 'imagecompare'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ISelectButtonWidget}. */
export function isSelectButtonWidget(
  widget: IBaseWidget
): widget is ISelectButtonWidget {
  return widget.type === 'selectbutton'
}

/** Type guard: Narrow **from {@link IBaseWidget}** to {@link ITextareaWidget}. */
export function isTextareaWidget(
  widget: IBaseWidget
): widget is ITextareaWidget {
  return widget.type === 'textarea'
}

// #endregion Type Guards
