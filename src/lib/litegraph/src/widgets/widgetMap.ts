import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IAssetWidget,
  IBaseWidget,
  IComboWidget,
  IWidget,
  TWidgetType
} from '@/lib/litegraph/src/types/widgets'
import { toClass as instantiateClass } from '@/lib/litegraph/src/utils/type'

import { AssetWidget } from './AssetWidget'
import { BaseWidget } from './BaseWidget'
import { BooleanWidget } from './BooleanWidget'
import { BoundingBoxWidget } from './BoundingBoxWidget'
import { ButtonWidget } from './ButtonWidget'
import { ChartWidget } from './ChartWidget'
import { ColorWidget } from './ColorWidget'
import { ComboWidget } from './ComboWidget'
import { CurveWidget } from './CurveWidget'
import { FileUploadWidget } from './FileUploadWidget'
import { GalleriaWidget } from './GalleriaWidget'
import { GradientSliderWidget } from './GradientSliderWidget'
import { ImageCompareWidget } from './ImageCompareWidget'
import { BoundingBoxesWidget } from './BoundingBoxesWidget'
import { ColorsWidget } from './ColorsWidget'
import { CompositorWidget } from './CompositorWidget'
import { PainterWidget } from './PainterWidget'
import { RangeWidget } from './RangeWidget'
import { VideoEditWidget } from './VideoEditWidget'
import { ImageCropWidget } from './ImageCropWidget'
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
  gradientslider: GradientSliderWidget
  knob: KnobWidget
  combo: ComboWidget
  number: NumberWidget
  string: TextWidget
  text: TextWidget
  custom: LegacyWidget
  fileupload: FileUploadWidget
  color: ColorWidget
  markdown: MarkdownWidget
  treeselect: TreeSelectWidget
  multiselect: MultiSelectWidget
  chart: ChartWidget
  galleria: GalleriaWidget
  imagecompare: ImageCompareWidget
  selectbutton: SelectButtonWidget
  textarea: TextareaWidget
  asset: AssetWidget
  imagecrop: ImageCropWidget
  boundingbox: BoundingBoxWidget
  curve: CurveWidget
  painter: PainterWidget
  compositor: CompositorWidget
  range: RangeWidget
  videoedit: VideoEditWidget
  boundingboxes: BoundingBoxesWidget
  colors: ColorsWidget
  [key: string]: BaseWidget
}

const toWidgetClass = instantiateClass

function adoptConcreteWidget<C extends object>(widget: object, concrete: C): C {
  if (concrete === widget || !Object.isExtensible(widget)) return concrete

  const descriptors: PropertyDescriptorMap = {
    ...Object.getOwnPropertyDescriptors(concrete)
  }
  let prototype = Object.getPrototypeOf(concrete) as object | null
  while (prototype && prototype !== Object.prototype) {
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(prototype)
    )) {
      if (
        descriptors[key] === undefined &&
        (descriptor.get !== undefined || descriptor.set !== undefined)
      )
        descriptors[key] = descriptor
    }
    prototype = Object.getPrototypeOf(prototype) as object | null
  }

  const existingDescriptors = Object.getOwnPropertyDescriptors(widget)
  if (
    Object.keys(descriptors).some(
      (key) => existingDescriptors[key]?.configurable === false
    ) ||
    !Reflect.setPrototypeOf(widget, Object.getPrototypeOf(concrete))
  )
    return concrete

  Object.defineProperties(widget, descriptors)
  return widget as unknown as C
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
  const concrete = instantiateConcreteWidget(widget, node, wrapLegacyWidgets)
  return concrete && wrapLegacyWidgets
    ? adoptConcreteWidget(widget, concrete)
    : concrete
}

function instantiateConcreteWidget<TWidget extends IWidget | IBaseWidget>(
  widget: TWidget,
  node: LGraphNode,
  wrapLegacyWidgets: boolean
): WidgetTypeMap[TWidget['type']] | undefined {
  if (widget instanceof LegacyWidget && !wrapLegacyWidgets) return undefined
  if (widget instanceof BaseWidget) return widget

  // Assertion: TypeScript has no concept of "all strings except X"
  type RemoveBaseWidgetType<T> = T extends { type: TWidgetType } ? T : never
  const narrowedWidget = widget as RemoveBaseWidgetType<TWidget>

  switch (narrowedWidget.type) {
    case 'button':
      return toWidgetClass(ButtonWidget, narrowedWidget, node)
    case 'toggle':
      return toWidgetClass(BooleanWidget, narrowedWidget, node)
    case 'slider':
      return toWidgetClass(SliderWidget, narrowedWidget, node)
    case 'gradientslider':
      return toWidgetClass(GradientSliderWidget, narrowedWidget, node)
    case 'knob':
      return toWidgetClass(KnobWidget, narrowedWidget, node)
    case 'combo':
      return toWidgetClass(ComboWidget, narrowedWidget, node)
    case 'number':
      return toWidgetClass(NumberWidget, narrowedWidget, node)
    case 'string':
      return toWidgetClass(TextWidget, narrowedWidget, node)
    case 'text':
      return toWidgetClass(TextWidget, narrowedWidget, node)
    case 'fileupload':
      return toWidgetClass(FileUploadWidget, narrowedWidget, node)
    case 'color':
      return toWidgetClass(ColorWidget, narrowedWidget, node)
    case 'markdown':
      return toWidgetClass(MarkdownWidget, narrowedWidget, node)
    case 'treeselect':
      return toWidgetClass(TreeSelectWidget, narrowedWidget, node)
    case 'multiselect':
      return toWidgetClass(MultiSelectWidget, narrowedWidget, node)
    case 'chart':
      return toWidgetClass(ChartWidget, narrowedWidget, node)
    case 'galleria':
      return toWidgetClass(GalleriaWidget, narrowedWidget, node)
    case 'imagecompare':
      return toWidgetClass(ImageCompareWidget, narrowedWidget, node)
    case 'selectbutton':
      return toWidgetClass(SelectButtonWidget, narrowedWidget, node)
    case 'textarea':
      return toWidgetClass(TextareaWidget, narrowedWidget, node)
    case 'asset':
      return toWidgetClass(AssetWidget, narrowedWidget, node)
    case 'imagecrop':
      return toWidgetClass(ImageCropWidget, narrowedWidget, node)
    case 'boundingbox':
      return toWidgetClass(BoundingBoxWidget, narrowedWidget, node)
    case 'curve':
      return toWidgetClass(CurveWidget, narrowedWidget, node)
    case 'painter':
      return toWidgetClass(PainterWidget, narrowedWidget, node)
    case 'compositor':
      return toWidgetClass(CompositorWidget, narrowedWidget, node)
    case 'range':
      return toWidgetClass(RangeWidget, narrowedWidget, node)
    case 'videoedit':
      return toWidgetClass(VideoEditWidget, narrowedWidget, node)
    case 'boundingboxes':
      return toWidgetClass(BoundingBoxesWidget, narrowedWidget, node)
    case 'colors':
      return toWidgetClass(ColorsWidget, narrowedWidget, node)
    default: {
      if (wrapLegacyWidgets) return toWidgetClass(LegacyWidget, widget, node)
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
