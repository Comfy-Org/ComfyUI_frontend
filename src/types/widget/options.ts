/**
 * Widget options types.
 *
 * @module widget/options
 */

import type { Bounds } from '@/renderer/core/layout/types'

export interface WidgetOptionsBase {
  label?: string
  tooltip?: string
  readOnly?: boolean
  serialize?: boolean
}

export interface NumberWidgetOptions extends WidgetOptionsBase {
  min?: number
  max?: number
  step?: number
  precision?: number
}

export interface SliderWidgetOptions extends WidgetOptionsBase {
  min: number
  max: number
  step?: number
}

export interface KnobWidgetOptions extends WidgetOptionsBase {
  min: number
  max: number
  step?: number
  gradientStops?: string
}

export interface ComboWidgetOptions extends WidgetOptionsBase {
  values: Array<string | number>
  filterable?: boolean
  getOptionLabel?: (value?: string | null) => string
}

export interface StringWidgetOptions extends WidgetOptionsBase {
  multiline?: boolean
}

export interface ButtonWidgetOptions extends WidgetOptionsBase {
  iconClass?: string
}

export interface FileUploadWidgetOptions extends WidgetOptionsBase {
  accept?: string
}

export interface AssetWidgetOptions extends WidgetOptionsBase {
  openModal?: (widget: unknown) => void
  nodeType?: string
}

export interface TreeSelectWidgetOptions extends WidgetOptionsBase {
  values?: Array<string | object>
}

export interface MultiSelectWidgetOptions extends WidgetOptionsBase {
  values?: string[]
}

export interface SelectButtonWidgetOptions extends WidgetOptionsBase {
  values: string[]
}

export interface ImageCropWidgetOptions extends WidgetOptionsBase {
  aspectRatio?: number
}

export interface BoundingBoxWidgetOptions extends WidgetOptionsBase {
  bounds?: Bounds
}

export interface CustomWidgetOptions extends WidgetOptionsBase {
  [key: string]: unknown
}
