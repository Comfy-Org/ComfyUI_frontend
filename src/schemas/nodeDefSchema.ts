import type { ZodType } from 'zod'
import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

function inputSpec<TType extends ZodType, TSpec extends ZodType>(
  spec: [TType, TSpec],
  allowUpcast: boolean = true
) {
  const [inputType, inputSpec] = spec
  // e.g. "INT" => ["INT", {}]
  const upcastTypes = allowUpcast
    ? [inputType.transform((type) => [type, {}])]
    : []

  return z.union([
    z.tuple([inputType, inputSpec]),
    z.tuple([inputType]).transform(([type]) => [type, {}]),
    ...upcastTypes
  ])
}

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

const zBaseInputOptions = z
  .object({
    default: z.any().optional(),
    defaultInput: z.boolean().optional(),
    forceInput: z.boolean().optional(),
    tooltip: z.string().optional(),
    hidden: z.boolean().optional(),
    advanced: z.boolean().optional(),
    /** Backend-only properties. */
    rawLink: z.boolean().optional(),
    lazy: z.boolean().optional()
  })
  .passthrough()

const zNumericInputOptions = zBaseInputOptions.extend({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  // Note: Many node authors are using INT to pass list of INT.
  // TODO: Add list of ints type.
  default: z.union([z.number(), z.array(z.number())]).optional()
})

const zIntInputOptions = zNumericInputOptions.extend({
  /**
   * If true, a linked widget will be added to the node to select the mode
   * of `control_after_generate`.
   */
  control_after_generate: z.boolean().optional()
})

const zFloatInputOptions = zNumericInputOptions.extend({
  round: z.union([z.number(), z.literal(false)]).optional()
})

const zBooleanInputOptions = zBaseInputOptions.extend({
  label_on: z.string().optional(),
  label_off: z.string().optional(),
  default: z.boolean().optional()
})

const zStringInputOptions = zBaseInputOptions.extend({
  default: z.string().optional(),
  multiline: z.boolean().optional(),
  dynamicPrompts: z.boolean().optional(),

  // Multiline-only fields
  defaultVal: z.string().optional(),
  placeholder: z.string().optional()
})

const zComboInputOptions = zBaseInputOptions.extend({
  control_after_generate: z.boolean().optional(),
  image_upload: z.boolean().optional(),
  image_folder: z.enum(['input', 'output', 'temp']).optional(),
  allow_batch: z.boolean().optional(),
  remote: zRemoteWidgetConfig.optional()
})

const zIntInputSpec = inputSpec([z.literal('INT'), zIntInputOptions])
const zFloatInputSpec = inputSpec([z.literal('FLOAT'), zFloatInputOptions])
const zBooleanInputSpec = inputSpec([
  z.literal('BOOLEAN'),
  zBooleanInputOptions
])
const zStringInputSpec = inputSpec([z.literal('STRING'), zStringInputOptions])
const zComboInputSpec = inputSpec(
  [z.array(z.any()), zComboInputOptions],
  /* allowUpcast=*/ false
)
const zComboInputSpecV2 = inputSpec(
  [z.literal('COMBO'), zComboInputOptions],
  /* allowUpcast=*/ false
)

export function isComboInputSpecV1(
  inputSpec: InputSpec
): inputSpec is ComboInputSpec {
  return Array.isArray(inputSpec[0])
}

const excludedLiterals = new Set(['INT', 'FLOAT', 'BOOLEAN', 'STRING', 'COMBO'])
const zCustomInputSpec = inputSpec([
  z.string().refine((value) => !excludedLiterals.has(value)),
  zBaseInputOptions
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
const zComfyComboOutput = z.array(z.any())
const zComfyOutputTypesSpec = z.array(
  z.union([zComfyNodeDataType, zComfyComboOutput])
)

const zComfyNodeDef = z.object({
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
  experimental: z.boolean().optional()
})

// `/object_info`
export type ComboInputSpec = z.infer<typeof zComboInputSpec>
export type ComboInputSpecV2 = z.infer<typeof zComboInputSpecV2>
export type InputSpec = z.infer<typeof zInputSpec>
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
