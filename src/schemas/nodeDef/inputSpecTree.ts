import type { ZodError, z } from 'zod'

import { isTrustedObjectInfo } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
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

const MAX_SPEC_DRIFT_REPORTS = 10
const reportedSpecDrift = new Set<string>()

function warnSpecDrift(
  spec: InputSpecV2,
  error: ZodError,
  optionIndex?: number
): void {
  const location = JSON.stringify([spec.name, spec.type, optionIndex])
  if (
    reportedSpecDrift.has(location) ||
    reportedSpecDrift.size >= MAX_SPEC_DRIFT_REPORTS
  )
    return

  reportedSpecDrift.add(location)

  reportError(new Error('Unable to parse dynamic node input specification'), {
    surface: 'graph',
    errorType: 'error_parsing_node_input_spec',
    tags: {
      failure_kind: 'degraded',
      feature_area: 'node_definition',
      operation: 'parse_input_spec',
      outcome: 'recovered'
    },
    context: {
      controlType: spec.type,
      optionIndex,
      issueCount: error.issues.length
    },
    level: 'warning'
  })
}

function parseSpec<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  spec: InputSpecV2,
  option?: { option: unknown; index: number }
): T[] {
  const value = option ? option.option : spec
  if (isTrustedObjectInfo) return [value as T]

  const parsed = schema.safeParse(value)
  if (parsed.success) return [parsed.data]
  warnSpecDrift(spec, parsed.error, option?.index)
  return []
}

/**
 * Split a possibly comma-composite slot type into its parts.
 *
 * Accepts `unknown` on purpose: node defs are never validated on the way in
 * (`validateComfyNodeDef` has no callers), so a custom node can put anything
 * in an output type. This runs inside the `ComfyNodeDefImpl` constructor, and
 * throwing there aborts the whole node-def update and empties the library.
 */
export function splitSlotTypes(type: unknown): string[] {
  if (typeof type !== 'string') return []

  return type
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
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
      parseSpec(zDynamicGroupInputSpec.items[1], spec).map(
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

/**
 * Every input spec nested inside `spec`, depth first, in declaration order.
 *
 * Nested specs arrive from the backend as V1 tuples even when `spec` itself
 * has already been normalized, so each child is converted on the way out.
 * The tree is finite: specs originate from parsed `/object_info` JSON, which
 * cannot contain cycles.
 */
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
 * The option keys of a DynamicCombo, in declaration order.
 *
 * Callers that only need the choices should use this rather than
 * {@link dynamicComboOptionTypes}, which walks each option's whole nested
 * input tree.
 */
export function dynamicComboOptionKeys(spec: InputSpecV2): string[] {
  if (spec.type !== 'COMFY_DYNAMICCOMBO_V3') return []

  return parseDynamicComboOptions(spec).map(({ key }) => key)
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

  return parseDynamicComboOptions(spec).map(({ key, inputs }) => ({
    key,
    types: [...toInputSpecsV2(inputs)]
      .flatMap(inputSpecTree)
      .flatMap(ownSlotTypes)
  }))
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

  return parseSpec(zMatchTypeOptions, spec)
    .map(({ template }) => ({
      templateId: template.template_id,
      allowedTypes: splitSlotTypes(template.allowed_types)
    }))
    .at(0)
}
