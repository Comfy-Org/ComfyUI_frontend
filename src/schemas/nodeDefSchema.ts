import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

const zComboOption = z.union([z.string(), z.number()])
const zRemoteWidgetConfig = z.object({
  route: z.string().url().or(z.string().startsWith('/')),
  refresh: z.number().gte(128).safe().or(z.number().lte(0).safe()).optional(),
  response_key: z.string().optional(),
  query_params: z.record(z.string(), z.string()).optional(),
  refresh_button: z.boolean().optional(),
  control_after_refresh: z.enum(['first', 'last']).optional(),
  timeout: z.number().gte(0).optional(),
  max_retries: z.number().gte(0).optional()
})
const zMultiSelectOption = z.object({
  placeholder: z.string().optional(),
  chip: z.boolean().optional()
})

export const zBaseInputOptions = z
  .object({
    default: z.any().optional(),
    defaultInput: z.boolean().optional(),
    forceInput: z.boolean().optional(),
    tooltip: z.string().optional(),
    hidden: z.boolean().optional(),
    advanced: z.boolean().optional(),
    widgetType: z.string().optional(),
    /** Backend-only properties. */
    rawLink: z.boolean().optional(),
    lazy: z.boolean().optional()
  })
  .passthrough()

export const zNumericInputOptions = zBaseInputOptions.extend({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  /** Note: Many node authors are using INT/FLOAT to pass list of INT/FLOAT. */
  default: z.union([z.number(), z.array(z.number())]).optional(),
  display: z.enum(['slider', 'number', 'knob']).optional()
})

export const zIntInputOptions = zNumericInputOptions.extend({
  /**
   * If true, a linked widget will be added to the node to select the mode
   * of `control_after_generate`.
   */
  control_after_generate: z.boolean().optional()
})

export const zFloatInputOptions = zNumericInputOptions.extend({
  round: z.union([z.number(), z.literal(false)]).optional()
})

export const zBooleanInputOptions = zBaseInputOptions.extend({
  label_on: z.string().optional(),
  label_off: z.string().optional(),
  default: z.boolean().optional()
})

export const zStringInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(),
  multiline: z.boolean().optional(),
  dynamicPrompts: z.boolean().optional(),

  // Multiline-only fields
  defaultVal: z.string().optional(),
  placeholder: z.string().optional()
})

export const zComboInputOptions = zBaseInputOptions.extend({
  control_after_generate: z.boolean().optional(),
  image_upload: z.boolean().optional(),
  image_folder: z.enum(['input', 'output', 'temp']).optional(),
  allow_batch: z.boolean().optional(),
  video_upload: z.boolean().optional(),
  animated_image_upload: z.boolean().optional(),
  options: z.array(zComboOption).optional(),
  remote: zRemoteWidgetConfig.optional(),
  /** Whether the widget is a multi-select widget. */
  multi_select: zMultiSelectOption.optional()
})

const zIntInputSpec = z.tuple([z.literal('INT'), zIntInputOptions.optional()])
const zFloatInputSpec = z.tuple([
  z.literal('FLOAT'),
  zFloatInputOptions.optional()
])
const zBooleanInputSpec = z.tuple([
  z.literal('BOOLEAN'),
  zBooleanInputOptions.optional()
])
const zStringInputSpec = z.tuple([
  z.literal('STRING'),
  zStringInputOptions.optional()
])
/**
 * Legacy combo syntax.
 * @deprecated Use `zComboInputSpecV2` instead.
 */
const zComboInputSpec = z.tuple([
  z.array(zComboOption),
  zComboInputOptions.optional()
])
const zComboInputSpecV2 = z.tuple([
  z.literal('COMBO'),
  zComboInputOptions.optional()
])

export function isComboInputSpecV1(
  inputSpec: InputSpec
): inputSpec is ComboInputSpec {
  return Array.isArray(inputSpec[0])
}

export function isIntInputSpec(
  inputSpec: InputSpec
): inputSpec is IntInputSpec {
  return inputSpec[0] === 'INT'
}

export function isFloatInputSpec(
  inputSpec: InputSpec
): inputSpec is FloatInputSpec {
  return inputSpec[0] === 'FLOAT'
}

export function isBooleanInputSpec(
  inputSpec: InputSpec
): inputSpec is BooleanInputSpec {
  return inputSpec[0] === 'BOOLEAN'
}

export function isStringInputSpec(
  inputSpec: InputSpec
): inputSpec is StringInputSpec {
  return inputSpec[0] === 'STRING'
}

export function isComboInputSpecV2(
  inputSpec: InputSpec
): inputSpec is ComboInputSpecV2 {
  return inputSpec[0] === 'COMBO'
}

export function isCustomInputSpec(
  inputSpec: InputSpec
): inputSpec is CustomInputSpec {
  return typeof inputSpec[0] === 'string' && !excludedLiterals.has(inputSpec[0])
}

export function isComboInputSpec(
  inputSpec: InputSpec
): inputSpec is ComboInputSpec | ComboInputSpecV2 {
  return isComboInputSpecV1(inputSpec) || isComboInputSpecV2(inputSpec)
}

/**
 * Get the type of an input spec.
 *
 * @param inputSpec - The input spec to get the type of.
 * @returns The type of the input spec.
 */
export function getInputSpecType(inputSpec: InputSpec): string {
  return isComboInputSpec(inputSpec) ? 'COMBO' : inputSpec[0]
}

/**
 * Get the combo options from a combo input spec.
 *
 * @param inputSpec - The input spec to get the combo options from.
 * @returns The combo options.
 */
export function getComboSpecComboOptions(
  inputSpec: ComboInputSpec | ComboInputSpecV2
): (number | string)[] {
  return (
    (isComboInputSpecV2(inputSpec) ? inputSpec[1]?.options : inputSpec[0]) ?? []
  )
}

const excludedLiterals = new Set(['INT', 'FLOAT', 'BOOLEAN', 'STRING', 'COMBO'])
const zCustomInputSpec = z.tuple([
  z.string().refine((value) => !excludedLiterals.has(value)),
  zBaseInputOptions.optional()
])

const zInputSpec = z.union([
  zIntInputSpec,
  zFloatInputSpec,
  zBooleanInputSpec,
  zStringInputSpec,
  zComboInputSpec,
  zComboInputSpecV2,
  zCustomInputSpec
])

const zComfyInputsSpec = z.object({
  required: z.record(zInputSpec).optional(),
  optional: z.record(zInputSpec).optional(),
  // Frontend repo is not using it, but some custom nodes are using the
  // hidden field to pass various values.
  hidden: z.record(z.any()).optional()
})

const zComfyNodeDataType = z.string()
const zComfyComboOutput = z.array(zComboOption)
const zComfyOutputTypesSpec = z.array(
  z.union([zComfyNodeDataType, zComfyComboOutput])
)

export const zComfyNodeDef = z.object({
  input: zComfyInputsSpec.optional(),
  output: zComfyOutputTypesSpec.optional(),
  output_is_list: z.array(z.boolean()).optional(),
  output_name: z.array(z.string()).optional(),
  output_tooltips: z.array(z.string()).optional(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  category: z.string(),
  output_node: z.boolean(),
  python_module: z.string(),
  deprecated: z.boolean().optional(),
  experimental: z.boolean().optional(),
  /**
   * Whether the node is an API node. Running API nodes requires login to
   * Comfy Org account.
   * https://www.comfy.org/faq
   */
  api_node: z.boolean().optional()
})

// `/object_info`
export type ComfyInputsSpec = z.infer<typeof zComfyInputsSpec>
export type ComfyOutputTypesSpec = z.infer<typeof zComfyOutputTypesSpec>
export type ComfyNodeDef = z.infer<typeof zComfyNodeDef>
export type RemoteWidgetConfig = z.infer<typeof zRemoteWidgetConfig>

// Input specs
export type IntInputOptions = z.infer<typeof zIntInputOptions>
export type FloatInputOptions = z.infer<typeof zFloatInputOptions>
export type BooleanInputOptions = z.infer<typeof zBooleanInputOptions>
export type StringInputOptions = z.infer<typeof zStringInputOptions>
export type ComboInputOptions = z.infer<typeof zComboInputOptions>
export type BaseInputOptions = z.infer<typeof zBaseInputOptions>
export type NumericInputOptions = z.infer<typeof zNumericInputOptions>

export type IntInputSpec = z.infer<typeof zIntInputSpec>
export type FloatInputSpec = z.infer<typeof zFloatInputSpec>
export type BooleanInputSpec = z.infer<typeof zBooleanInputSpec>
export type StringInputSpec = z.infer<typeof zStringInputSpec>
export type ComboInputSpec = z.infer<typeof zComboInputSpec>
export type ComboInputSpecV2 = z.infer<typeof zComboInputSpecV2>
export type CustomInputSpec = z.infer<typeof zCustomInputSpec>
export type InputSpec = z.infer<typeof zInputSpec>

export function validateComfyNodeDef(
  data: any,
  onError: (error: string) => void = console.warn
): ComfyNodeDef | null {
  const result = zComfyNodeDef.safeParse(data)
  if (!result.success) {
    const zodError = fromZodError(result.error)
    onError(
      `Invalid ComfyNodeDef: ${JSON.stringify(data)}\n${zodError.message}`
    )
    return null
  }
  return result.data
}
