/**
 * Per-kind widget core interfaces with discriminated `kind` field.
 *
 * @module widget/cores
 */

import type { Bounds } from '@/renderer/core/layout/types'

import type { WidgetIdentity } from './identity'
import type {
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

export interface WidgetCoreBase extends WidgetIdentity {
  hidden?: boolean
  disabled?: boolean
  advanced?: boolean
  promoted?: boolean
}

export interface AssetWidgetCore extends WidgetCoreBase {
  kind: 'asset'
  value: string
  options: AssetWidgetOptions
}

export interface BooleanWidgetCore extends WidgetCoreBase {
  kind: 'boolean'
  value: boolean
  options: WidgetOptionsBase
}

export interface BoundingBoxWidgetCore extends WidgetCoreBase {
  kind: 'boundingbox'
  value: Bounds
  options: BoundingBoxWidgetOptions
}

export interface ButtonWidgetCore extends WidgetCoreBase {
  kind: 'button'
  value: string | undefined
  options: ButtonWidgetOptions
}

export interface ChartWidgetCore extends WidgetCoreBase {
  kind: 'chart'
  value: object
  options: WidgetOptionsBase
}

export interface ColorWidgetCore extends WidgetCoreBase {
  kind: 'color'
  value: string
  options: WidgetOptionsBase
}

export interface ComboWidgetCore extends WidgetCoreBase {
  kind: 'combo'
  value: string | number
  options: ComboWidgetOptions
}

export interface CustomWidgetCore extends WidgetCoreBase {
  kind: 'custom'
  value: unknown
  options: CustomWidgetOptions
}

export interface FileUploadWidgetCore extends WidgetCoreBase {
  kind: 'fileupload'
  value: string
  options: FileUploadWidgetOptions
}

export interface GalleriaWidgetCore extends WidgetCoreBase {
  kind: 'galleria'
  value: string[]
  options: WidgetOptionsBase
}

export interface ImageWidgetCore extends WidgetCoreBase {
  kind: 'image'
  value: string
  options: WidgetOptionsBase
}

export interface ImageCompareWidgetCore extends WidgetCoreBase {
  kind: 'imagecompare'
  value: string[]
  options: WidgetOptionsBase
}

export interface ImageCropWidgetCore extends WidgetCoreBase {
  kind: 'imagecrop'
  value: Bounds
  options: ImageCropWidgetOptions
}

export interface KnobWidgetCore extends WidgetCoreBase {
  kind: 'knob'
  value: number
  options: KnobWidgetOptions
}

export interface MarkdownWidgetCore extends WidgetCoreBase {
  kind: 'markdown'
  value: string
  options: WidgetOptionsBase
}

export interface MultiSelectWidgetCore extends WidgetCoreBase {
  kind: 'multiselect'
  value: string[]
  options: MultiSelectWidgetOptions
}

export interface NumberWidgetCore extends WidgetCoreBase {
  kind: 'number'
  value: number
  options: NumberWidgetOptions
}

export interface SelectButtonWidgetCore extends WidgetCoreBase {
  kind: 'selectbutton'
  value: string
  options: SelectButtonWidgetOptions
}

export interface SliderWidgetCore extends WidgetCoreBase {
  kind: 'slider'
  value: number
  options: SliderWidgetOptions
}

export interface StringWidgetCore extends WidgetCoreBase {
  kind: 'string'
  value: string
  options: StringWidgetOptions
}

export interface TextareaWidgetCore extends WidgetCoreBase {
  kind: 'textarea'
  value: string
  options: StringWidgetOptions
}

export interface TreeSelectWidgetCore extends WidgetCoreBase {
  kind: 'treeselect'
  value: string | string[]
  options: TreeSelectWidgetOptions
}
