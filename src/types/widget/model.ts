/**
 * WidgetModel: the canonical discriminated union of all widget types.
 *
 * @module widget/model
 */

import type {
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
  TreeSelectWidgetCore
} from './cores'

export type WidgetModel =
  | AssetWidgetCore
  | BooleanWidgetCore
  | BoundingBoxWidgetCore
  | ButtonWidgetCore
  | ChartWidgetCore
  | ColorWidgetCore
  | ComboWidgetCore
  | CustomWidgetCore
  | FileUploadWidgetCore
  | GalleriaWidgetCore
  | ImageCompareWidgetCore
  | ImageCropWidgetCore
  | ImageWidgetCore
  | KnobWidgetCore
  | MarkdownWidgetCore
  | MultiSelectWidgetCore
  | NumberWidgetCore
  | SelectButtonWidgetCore
  | SliderWidgetCore
  | StringWidgetCore
  | TextareaWidgetCore
  | TreeSelectWidgetCore

export type WidgetKind = WidgetModel['kind']

export type WidgetValueFor<K extends WidgetKind> = Extract<
  WidgetModel,
  { kind: K }
>['value']

export type WidgetOptionsFor<K extends WidgetKind> = Extract<
  WidgetModel,
  { kind: K }
>['options']

export type WidgetCoreFor<K extends WidgetKind> = Extract<
  WidgetModel,
  { kind: K }
>

export function assertNever(x: never): never {
  throw new Error(`Unexpected widget kind: ${x}`)
}
