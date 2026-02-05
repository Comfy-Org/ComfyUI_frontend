/**
 * Canonical widget type definitions.
 *
 * @module widget
 */

export type { NodeId, WidgetId } from './primitives'
export { widgetId } from './primitives'

export type { WidgetIdentity } from './identity'
export { getWidgetId } from './identity'

export type {
  AssetWidgetOptions,
  BoundingBoxWidgetOptions,
  ButtonWidgetOptions,
  ComboWidgetOptions,
  CustomWidgetOptions,
  FileUploadWidgetOptions,
  ImageCropWidgetOptions,
  KnobWidgetOptions,
  MultiSelectWidgetOptions,
  NumberWidgetOptions,
  SelectButtonWidgetOptions,
  SliderWidgetOptions,
  StringWidgetOptions,
  TreeSelectWidgetOptions,
  WidgetOptionsBase
} from './options'

export type {
  AssetWidgetCore,
  BooleanWidgetCore,
  BoundingBoxWidgetCore,
  ButtonWidgetCore,
  ChartWidgetCore,
  ColorWidgetCore,
  ComboWidgetCore,
  CustomWidgetCore,
  FileUploadWidgetCore,
  GalleriaWidgetCore,
  ImageCompareWidgetCore,
  ImageCropWidgetCore,
  ImageWidgetCore,
  KnobWidgetCore,
  MarkdownWidgetCore,
  MultiSelectWidgetCore,
  NumberWidgetCore,
  SelectButtonWidgetCore,
  SliderWidgetCore,
  StringWidgetCore,
  TextareaWidgetCore,
  TreeSelectWidgetCore,
  WidgetCoreBase
} from './cores'

export type {
  WidgetCoreFor,
  WidgetKind,
  WidgetModel,
  WidgetOptionsFor,
  WidgetValueFor
} from './model'
export { assertNever } from './model'

export type { WidgetRef } from './ref'

export type { WidgetLayoutState, WidgetRuntimeState } from './state'
