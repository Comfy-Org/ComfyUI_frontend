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
  category: z.string(),
  output_node: z.boolean(),
  python_module: z.string(),
  deprecated: z.boolean().optional(),
  experimental: z.boolean().optional(),
  api_node: z.boolean().optional()
})

// Export types
export type IntInputSpec = z.infer<typeof zIntInputSpec>
export type FloatInputSpec = z.infer<typeof zFloatInputSpec>
export type BooleanInputSpec = z.infer<typeof zBooleanInputSpec>
export type StringInputSpec = z.infer<typeof zStringInputSpec>
export type ComboInputSpec = z.infer<typeof zComboInputSpec>
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

/**
 * Check if a node definition is a valid ComfyUI node definition.
 *
 * Note: This is just a simple check against the V1 schema.
 *
 * @param nodeDef - The node definition to check.
 * @returns True if the node definition is valid, false otherwise.
 */
export const isComfyNodeDef = (nodeDef: unknown): nodeDef is ComfyNodeDef => {
  return (
    !!nodeDef &&
    typeof nodeDef === 'object' &&
    ['inputs', 'outputs'].every((key) => key in nodeDef)
  )
}
