import { z } from 'zod'

import {
  zBaseInputOptions,
  zBooleanInputOptions,
  zComboInputOptions,
  zFloatInputOptions,
  zIntInputOptions,
  zStringInputOptions
} from '@/schemas/nodeDefSchema'

const zIntInputSpec = zIntInputOptions.extend({
  type: z.literal('INT'),
  name: z.string(),
  isOptional: z.boolean().optional()
})

const zFloatInputSpec = zFloatInputOptions.extend({
  type: z.literal('FLOAT'),
  name: z.string(),
  isOptional: z.boolean().optional()
})

const zBooleanInputSpec = zBooleanInputOptions.extend({
  type: z.literal('BOOLEAN'),
  name: z.string(),
  isOptional: z.boolean().optional()
})

const zStringInputSpec = zStringInputOptions.extend({
  type: z.literal('STRING'),
  name: z.string(),
  isOptional: z.boolean().optional()
})

const zComboInputSpec = zComboInputOptions.extend({
  type: z.literal('COMBO'),
  name: z.string(),
  isOptional: z.boolean().optional()
})

const zColorInputSpec = zBaseInputOptions.extend({
  type: z.literal('COLOR'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      default: z.string().optional()
    })
    .optional()
})

const zFileUploadInputSpec = zBaseInputOptions.extend({
  type: z.literal('FILEUPLOAD'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z.record(z.unknown()).optional()
})

const zImageInputSpec = zBaseInputOptions.extend({
  type: z.literal('IMAGE'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z.record(z.unknown()).optional()
})

const zImageCompareInputSpec = zBaseInputOptions.extend({
  type: z.literal('IMAGECOMPARE'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z.record(z.unknown()).optional()
})

const zMarkdownInputSpec = zBaseInputOptions.extend({
  type: z.literal('MARKDOWN'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      content: z.string().optional()
    })
    .optional()
})

const zTreeSelectInputSpec = zBaseInputOptions.extend({
  type: z.literal('TREESELECT'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      multiple: z.boolean().optional(),
      values: z.array(z.unknown()).optional()
    })
    .optional()
})

const zMultiSelectInputSpec = zBaseInputOptions.extend({
  type: z.literal('MULTISELECT'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      values: z.array(z.string()).optional()
    })
    .optional()
})

const zChartInputSpec = zBaseInputOptions.extend({
  type: z.literal('CHART'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      type: z.enum(['bar', 'line']).optional(),
      data: z.object({}).optional()
    })
    .optional()
})

const zGalleriaInputSpec = zBaseInputOptions.extend({
  type: z.literal('GALLERIA'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      images: z.array(z.string()).optional()
    })
    .optional()
})

const zSelectButtonInputSpec = zBaseInputOptions.extend({
  type: z.literal('SELECTBUTTON'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      values: z.array(z.string()).optional()
    })
    .optional()
})

const zTextareaInputSpec = zBaseInputOptions.extend({
  type: z.literal('TEXTAREA'),
  name: z.string(),
  isOptional: z.boolean().optional(),
  options: z
    .object({
      rows: z.number().optional(),
      cols: z.number().optional(),
      default: z.string().optional()
    })
    .optional()
})

const zCustomInputSpec = zBaseInputOptions.extend({
  type: z.string(),
  name: z.string(),
  isOptional: z.boolean().optional()
})

const zInputSpec = z.union([
  zIntInputSpec,
  zFloatInputSpec,
  zBooleanInputSpec,
  zStringInputSpec,
  zComboInputSpec,
  zColorInputSpec,
  zFileUploadInputSpec,
  zImageInputSpec,
  zImageCompareInputSpec,
  zMarkdownInputSpec,
  zTreeSelectInputSpec,
  zMultiSelectInputSpec,
  zChartInputSpec,
  zGalleriaInputSpec,
  zSelectButtonInputSpec,
  zTextareaInputSpec,
  zCustomInputSpec
])

// Output specs
const zOutputSpec = z.object({
  index: z.number(),
  name: z.string(),
  type: z.string(),
  is_list: z.boolean(),
  options: z.array(z.any()).optional(),
  tooltip: z.string().optional()
})

// Main node definition schema
export const zComfyNodeDef = z.object({
  inputs: z.record(zInputSpec),
  outputs: z.array(zOutputSpec),
  hidden: z.record(z.any()).optional(),

  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  help: z.string().optional(),
  category: z.string(),
  output_node: z.boolean(),
  python_module: z.string(),
  deprecated: z.boolean().optional(),
  experimental: z.boolean().optional(),
  api_node: z.boolean().optional()
})

// Export types
type IntInputSpec = z.infer<typeof zIntInputSpec>
type FloatInputSpec = z.infer<typeof zFloatInputSpec>
type BooleanInputSpec = z.infer<typeof zBooleanInputSpec>
type StringInputSpec = z.infer<typeof zStringInputSpec>
export type ComboInputSpec = z.infer<typeof zComboInputSpec>
export type ColorInputSpec = z.infer<typeof zColorInputSpec>
export type FileUploadInputSpec = z.infer<typeof zFileUploadInputSpec>
export type ImageCompareInputSpec = z.infer<typeof zImageCompareInputSpec>
export type TreeSelectInputSpec = z.infer<typeof zTreeSelectInputSpec>
export type MultiSelectInputSpec = z.infer<typeof zMultiSelectInputSpec>
export type ChartInputSpec = z.infer<typeof zChartInputSpec>
export type GalleriaInputSpec = z.infer<typeof zGalleriaInputSpec>
export type SelectButtonInputSpec = z.infer<typeof zSelectButtonInputSpec>
export type TextareaInputSpec = z.infer<typeof zTextareaInputSpec>
export type CustomInputSpec = z.infer<typeof zCustomInputSpec>

export type InputSpec = z.infer<typeof zInputSpec>
export type OutputSpec = z.infer<typeof zOutputSpec>
export type ComfyNodeDef = z.infer<typeof zComfyNodeDef>

export const isIntInputSpec = (
  inputSpec: InputSpec
): inputSpec is IntInputSpec => {
  return inputSpec.type === 'INT'
}

export const isFloatInputSpec = (
  inputSpec: InputSpec
): inputSpec is FloatInputSpec => {
  return inputSpec.type === 'FLOAT'
}

export const isBooleanInputSpec = (
  inputSpec: InputSpec
): inputSpec is BooleanInputSpec => {
  return inputSpec.type === 'BOOLEAN'
}

export const isStringInputSpec = (
  inputSpec: InputSpec
): inputSpec is StringInputSpec => {
  return inputSpec.type === 'STRING'
}

export const isComboInputSpec = (
  inputSpec: InputSpec
): inputSpec is ComboInputSpec => {
  return inputSpec.type === 'COMBO'
}

export const isChartInputSpec = (
  inputSpec: InputSpec
): inputSpec is ChartInputSpec => {
  return inputSpec.type === 'CHART'
}
