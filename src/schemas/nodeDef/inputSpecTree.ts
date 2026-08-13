import type { ZodError } from 'zod'

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
  zDynamicComboOptions,
  zMatchTypeOptions
} from '@/schemas/nodeDefSchema'

/**
 * How one dynamic control type contributes to the input tree.
 *
 * `nestedInputs` yields the input groups the control wraps; `ownTypes` yields
 * the concrete slot types the control contributes itself. A control is one or
 * the other: Autogrow and DynamicCombo are containers, MatchType is a leaf
 * that resolves to its allowed types.
 */
interface DynamicControl {
  nestedInputs: (spec: InputSpecV2) => ComfyInputsSpec[]
  ownTypes: (spec: InputSpecV2) => string[]
}

const none = () => []

function warnSpecDrift(
  spec: InputSpecV2,
  error: ZodError,
  optionIndex?: number
): void {
  const location =
    optionIndex === undefined ? '' : ` (option index ${optionIndex})`
  console.warn(
    `Unparseable ${spec.type} spec for input "${spec.name}"${location}; its nested input types will be missing.`,
    error.issues
  )
}

export function splitSlotTypes(type: string): string[] {
  return type
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

const dynamicControls = {
  COMFY_AUTOGROW_V3: {
    nestedInputs: (spec) => {
      const parsed = zAutogrowOptions.safeParse(spec)
      if (!parsed.success) {
        warnSpecDrift(spec, parsed.error)
        return []
      }
      return [parsed.data.template.input]
    },
    ownTypes: none
  },
  COMFY_DYNAMICCOMBO_V3: {
    nestedInputs: (spec) => {
      const parsed = zDynamicComboOptions.safeParse(spec)
      if (!parsed.success) {
        warnSpecDrift(spec, parsed.error)
        return []
      }
      return parsed.data.options.flatMap((option, index) => {
        const parsedOption = zDynamicComboOption.safeParse(option)
        if (!parsedOption.success) {
          warnSpecDrift(spec, parsedOption.error, index)
          return []
        }
        return [parsedOption.data.inputs]
      })
    },
    ownTypes: none
  },
  COMFY_MATCHTYPE_V3: {
    nestedInputs: none,
    ownTypes: (spec) => {
      const parsed = zMatchTypeOptions.safeParse(spec)
      if (!parsed.success) {
        warnSpecDrift(spec, parsed.error)
        return []
      }
      return splitSlotTypes(parsed.data.template.allowed_types)
    }
  }
} satisfies Record<DynamicControlType, DynamicControl>

function dynamicControlFor(spec: InputSpecV2): DynamicControl | undefined {
  return isDynamicControlType(spec.type)
    ? dynamicControls[spec.type]
    : undefined
}

/**
 * Every input spec nested inside `spec`, depth first, in declaration order.
 *
 * Nested specs arrive from the backend as V1 tuples even when `spec` itself
 * has already been normalized, so each child is converted on the way out.
 * The tree is finite: specs originate from parsed `/object_info` JSON, which
 * cannot contain cycles.
 */
export function* walkNestedInputSpecs(
  spec: InputSpecV2
): Generator<InputSpecV2> {
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

/** `spec` together with every spec nested inside it, depth first. */
export function inputSpecTree(spec: InputSpecV2): InputSpecV2[] {
  return [spec, ...walkNestedInputSpecs(spec)]
}

/**
 * The concrete slot types this spec contributes on its own, ignoring anything
 * nested inside it. A dynamic container contributes nothing; a MatchType
 * contributes its allowed types; anything else contributes its own type.
 */
export function ownSlotTypes(spec: InputSpecV2): string[] {
  const control = dynamicControlFor(spec)
  return control ? control.ownTypes(spec) : splitSlotTypes(spec.type)
}

/**
 * The slot types each DynamicCombo option would expose if selected.
 *
 * Unlike {@link collectSearchableInputTypes}, which unions every option, this
 * keeps options apart -- callers that need to know *which* selection produces
 * a type cannot work from the union.
 */
export function dynamicComboOptionTypes(
  spec: InputSpecV2
): { key: string; types: string[] }[] {
  if (spec.type !== 'COMFY_DYNAMICCOMBO_V3') return []

  const parsed = zDynamicComboOptions.safeParse(spec)
  if (!parsed.success) return []

  return parsed.data.options.flatMap((option) => {
    const parsedOption = zDynamicComboOption.safeParse(option)
    if (!parsedOption.success) return []

    const types = [...toInputSpecsV2(parsedOption.data.inputs)]
      .flatMap(inputSpecTree)
      .flatMap(ownSlotTypes)
    return [{ key: parsedOption.data.key, types }]
  })
}

/**
 * The MatchType template this spec participates in, if any.
 *
 * Outputs declared as COMFY_MATCHTYPE_V3 name their template via the node's
 * `output_matchtypes`, and resolve at runtime to a type the group's inputs
 * can produce. The allowed types are the upper bound of that resolution.
 */
export function matchTypeTemplate(
  spec: InputSpecV2
): { templateId: string; allowedTypes: string[] } | undefined {
  if (spec.type !== 'COMFY_MATCHTYPE_V3') return undefined

  const parsed = zMatchTypeOptions.safeParse(spec)
  if (!parsed.success) return undefined

  return {
    templateId: parsed.data.template.template_id,
    allowedTypes: splitSlotTypes(parsed.data.template.allowed_types)
  }
}
