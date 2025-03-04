import { z } from 'zod'

import {
  zBaseInputOptions,
  zBooleanInputOptions,
  zComboInputOptions,
  zFloatInputOptions,
  zIntInputOptions,
  zStringInputOptions
} from '@/schemas/nodeDefSchema'

const zBaseInputSpec = zBaseInputOptions.extend({
  name: z.string(),
  isOptional: z.boolean().optional()
})

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

const zCustomInputSpec = z.object({
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
  zBaseInputSpec,
  zCustomInputSpec
])

// Output specs
const zComfyOutputSpec = z.object({
  index: z.number(),
  name: z.string(),
  type: z.string(),
  is_list: z.boolean(),
  options: z.array(z.any()).optional(),
  tooltip: z.string().optional()
})

const zComfyOutputTypesSpec = z.array(z.union([z.string(), z.array(z.any())]))

// Main node definition schema
const zComfyNodeDef = z.object({
  inputs: z.record(zInputSpec),
  outputs: z.array(zComfyOutputSpec),
  hidden: z.record(z.any()).optional(),

  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  category: z.string(),
  output_node: z.boolean(),
  python_module: z.string(),
  deprecated: z.boolean().optional(),
  experimental: z.boolean().optional()
})

// Export types
export type BaseInputSpec = z.infer<typeof zBaseInputSpec>
export type IntInputSpec = z.infer<typeof zIntInputSpec>
export type FloatInputSpec = z.infer<typeof zFloatInputSpec>
export type BooleanInputSpec = z.infer<typeof zBooleanInputSpec>
export type StringInputSpec = z.infer<typeof zStringInputSpec>
export type ComboInputSpec = z.infer<typeof zComboInputSpec>
export type InputSpec = z.infer<typeof zInputSpec>

export type ComfyOutputSpec = z.infer<typeof zComfyOutputSpec>
export type ComfyOutputTypesSpec = z.infer<typeof zComfyOutputTypesSpec>
export type ComfyNodeDef = z.infer<typeof zComfyNodeDef>
