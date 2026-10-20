import type { ZodError, z } from 'zod'

import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type {
  ComfyInputsSpec,
  DynamicControlType
} from '@/schemas/nodeDefSchema'
import {
  isDynamicControlType,
  zAutogrowOptions,
  zDynamicComboOption,
  zDynamicComboSpecV2,
  zDynamicGroupInputSpec,
  zMatchTypeOptions
} from '@/schemas/nodeDefSchema'

interface DynamicControl {
  nestedInputs: (spec: InputSpecV2) => ComfyInputsSpec[]
  ownTypes: (spec: InputSpecV2) => string[]
}

const none = () => []

export type InputSpecDiagnosticSink = (
  spec: InputSpecV2,
  error: ZodError,
  optionIndex?: number
) => void

function splitSlotTypes(type: unknown): string[] {
  if (typeof type !== 'string') return []

  return type
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function createInputSpecInterpreter(
  warnSpecDrift: InputSpecDiagnosticSink,
  { skipValidation = () => false }: { skipValidation?: () => boolean } = {}
) {
  function parseSpec<T>(
    schema: z.ZodType<T>,
    spec: InputSpecV2,
    option?: { option: unknown; index: number }
  ): T[] {
    const value = option ? option.option : spec
    if (skipValidation()) return [value as T]

    const parsed = schema.safeParse(value)
    if (parsed.success) return [parsed.data]
    warnSpecDrift(spec, parsed.error, option?.index)
    return []
  }

  function parseDynamicComboOptions(
    spec: InputSpecV2
  ): { key: string; inputs: ComfyInputsSpec }[] {
    return parseSpec(zDynamicComboSpecV2, spec).flatMap(({ options }) =>
      options.flatMap((option, index) =>
        parseSpec(zDynamicComboOption, spec, { option, index })
      )
    )
  }

  const dynamicControls = {
    COMFY_DYNAMICGROUP_V3: {
      nestedInputs: (spec) =>
        parseSpec(zDynamicGroupInputSpec.def.items[1], spec).map(
          ({ template }) => template
        ),
      ownTypes: none
    },
    COMFY_AUTOGROW_V3: {
      nestedInputs: (spec) =>
        parseSpec(zAutogrowOptions, spec).map(({ template }) => template.input),
      ownTypes: none
    },
    COMFY_DYNAMICCOMBO_V3: {
      nestedInputs: (spec) =>
        parseDynamicComboOptions(spec).map(({ inputs }) => inputs),
      ownTypes: none
    },
    COMFY_MATCHTYPE_V3: {
      nestedInputs: none,
      ownTypes: (spec) =>
        parseSpec(zMatchTypeOptions, spec).flatMap(({ template }) =>
          splitSlotTypes(template.allowed_types)
        )
    }
  } satisfies Record<DynamicControlType, DynamicControl>

  function dynamicControlFor(spec: InputSpecV2): DynamicControl | undefined {
    return isDynamicControlType(spec.type)
      ? dynamicControls[spec.type]
      : undefined
  }

  function* walkNestedInputSpecs(spec: InputSpecV2): Generator<InputSpecV2> {
    const control = dynamicControlFor(spec)
    if (!control) return

    for (const inputs of control.nestedInputs(spec)) {
      for (const child of toInputSpecsV2(inputs)) {
        yield child
        yield* walkNestedInputSpecs(child)
      }
    }
  }

  function* toInputSpecsV2(inputs: ComfyInputsSpec): Generator<InputSpecV2> {
    const groups = [
      { specs: inputs.required, isOptional: false },
      { specs: inputs.optional, isOptional: true }
    ]
    for (const { specs, isOptional } of groups) {
      for (const [name, specV1] of Object.entries(specs ?? {})) {
        yield transformInputSpecV1ToV2(specV1, { name, isOptional })
      }
    }
  }

  function inputSpecTree(spec: InputSpecV2): InputSpecV2[] {
    return [spec, ...walkNestedInputSpecs(spec)]
  }

  function ownSlotTypes(spec: InputSpecV2): string[] {
    const control = dynamicControlFor(spec)
    return control ? control.ownTypes(spec) : splitSlotTypes(spec.type)
  }

  function dynamicComboOptionKeys(spec: InputSpecV2): string[] {
    if (spec.type !== 'COMFY_DYNAMICCOMBO_V3') return []

    return parseDynamicComboOptions(spec).map(({ key }) => key)
  }

  function dynamicComboOptionTypes(
    spec: InputSpecV2
  ): { key: string; types: string[] }[] {
    if (spec.type !== 'COMFY_DYNAMICCOMBO_V3') return []

    return parseDynamicComboOptions(spec).map(({ key, inputs }) => ({
      key,
      types: [...toInputSpecsV2(inputs)]
        .flatMap(inputSpecTree)
        .flatMap(ownSlotTypes)
    }))
  }

  function matchTypeTemplate(
    spec: InputSpecV2
  ): { templateId: string; allowedTypes: string[] } | undefined {
    if (spec.type !== 'COMFY_MATCHTYPE_V3') return undefined

    return parseSpec(zMatchTypeOptions, spec)
      .map(({ template }) => ({
        templateId: template.template_id,
        allowedTypes: splitSlotTypes(template.allowed_types)
      }))
      .at(0)
  }

  return {
    splitSlotTypes,
    inputSpecTree,
    ownSlotTypes,
    dynamicComboOptionKeys,
    dynamicComboOptionTypes,
    matchTypeTemplate
  }
}
