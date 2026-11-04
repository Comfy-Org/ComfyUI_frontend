import { countBy, sortBy } from 'es-toolkit'

import type { SettingSpec } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { humanizeKey } from '@/renderer/extensions/superComfy/router/routerPorts'
import {
  flattenSchema,
  propertiesOf,
  schemaAt,
  schemaType
} from '@/renderer/extensions/superComfy/router/routerSchema'
import type {
  FixedValue,
  JsonSchema,
  JsonValue,
  OpenApiDoc
} from '@/renderer/extensions/superComfy/router/routerTypes'

const EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  'model',
  'model_name',
  'model_id',
  'ai_model',
  'stream',
  'user',
  'callback_url',
  'external_task_id',
  'store',
  'include',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'previous_response_id',
  'truncation',
  'safetySettings',
  'systemInstruction',
  'metadata',
  'responseModalities',
  'responseSchema',
  'speechConfig',
  'max_tool_calls',
  'expire_at',
  'partial_images',
  'mask'
])

const COUNT_KEYS: ReadonlySet<string> = new Set([
  'n',
  'num_images',
  'num_outputs',
  'sampleCount',
  'number_of_images',
  'batch_size'
])

const FIXED_KEYS: Readonly<Record<string, JsonValue>> = {
  sequential_image_generation: 'disabled'
}

const CONTROL_ORDER: Record<SettingSpec['control'], number> = {
  select: 0,
  number: 1,
  text: 2,
  toggle: 3
}

const DEFAULT_MAX_TOKENS = 1024
const NUMBER_STEP = 0.01
const MULTILINE_MIN_LENGTH = 200

export interface SettingSource {
  root: readonly string[]
  exclude: ReadonlySet<string>
}

export interface ExtraSetting {
  spec: SettingSpec
  path?: string[]
}

export interface DerivedSettings {
  settings: SettingSpec[]
  settingPaths: Partial<Record<string, string[]>>
  fixed: FixedValue[]
}

interface FoundSetting {
  key: string
  path?: string[]
  spec: SettingSpec
}

type Found =
  | ({ kind: 'setting' } & FoundSetting)
  | { kind: 'fixed'; fixed: FixedValue }

function isExcludedKey(key: string): boolean {
  return EXCLUDED_KEYS.has(key) || key.startsWith('webhook')
}

function numericBound(
  inclusive: number | undefined,
  exclusive: number | boolean | undefined
): number | undefined {
  return inclusive ?? (typeof exclusive === 'number' ? exclusive : undefined)
}

interface SpecInput {
  name: string
  label: string
  schema: JsonSchema
  required: boolean
}

interface SchemaField {
  name: string
  schema: JsonSchema
  required: boolean
}

function selectSpec({
  name,
  label,
  schema,
  required
}: SpecInput): SettingSpec | null {
  const options = (schema.enum ?? []).filter(
    (value): value is string | number =>
      (typeof value === 'string' && value !== '') || typeof value === 'number'
  )
  if (options.length === 0) return null
  const declared = options.find((option) => option === schema.default)
  return {
    control: 'select',
    name,
    label,
    options,
    default: declared ?? (required ? options[0] : undefined),
    required
  }
}

function fallbackNumber(
  { name, required }: SpecInput,
  min: number | undefined
): number | undefined {
  if (name === 'max_tokens') return DEFAULT_MAX_TOKENS
  return required ? min : undefined
}

function numberSpec(input: SpecInput, kind: 'integer' | 'number'): SettingSpec {
  const { name, label, schema, required } = input
  const integer = kind === 'integer'
  const min = numericBound(schema.minimum, schema.exclusiveMinimum)
  const max = numericBound(schema.maximum, schema.exclusiveMaximum)
  const declared =
    typeof schema.default === 'number' ? schema.default : undefined
  return {
    control: 'number',
    name,
    label,
    integer,
    min,
    max,
    step: integer ? undefined : NUMBER_STEP,
    default: declared ?? fallbackNumber(input, min),
    required
  }
}

function toggleSpec({ name, label, schema, required }: SpecInput): SettingSpec {
  return {
    control: 'toggle',
    name,
    label,
    default: typeof schema.default === 'boolean' ? schema.default : undefined,
    required
  }
}

function textSpec({ name, label, schema, required }: SpecInput): SettingSpec {
  return {
    control: 'text',
    name,
    label,
    multiline:
      (schema.maxLength ?? 0) > MULTILINE_MIN_LENGTH ||
      /prompt|system/i.test(name),
    default: typeof schema.default === 'string' ? schema.default : undefined,
    required
  }
}

const SPEC_BUILDERS: Partial<
  Record<string, (input: SpecInput) => SettingSpec | null>
> = {
  integer: (input) => numberSpec(input, 'integer'),
  number: (input) => numberSpec(input, 'number'),
  boolean: toggleSpec,
  string: textSpec
}

function toSettingSpec(
  doc: OpenApiDoc,
  field: SchemaField
): SettingSpec | null {
  const schema = flattenSchema(doc, field.schema)
  if (schema.const !== undefined || schema.deprecated) return null
  const input: SpecInput = {
    name: field.name,
    label: schema.title ?? humanizeKey(field.name),
    schema,
    required: field.required
  }
  if (schema.enum?.length) return selectSpec(input)
  const build = SPEC_BUILDERS[schemaType(schema) ?? '']
  return build ? build(input) : null
}

function classify(
  doc: OpenApiDoc,
  source: SettingSource,
  field: SchemaField
): Found[] {
  const key = field.name
  if (source.exclude.has(key) || isExcludedKey(key)) return []
  const path = [...source.root, key]
  if (COUNT_KEYS.has(key)) return [{ kind: 'fixed', fixed: { path, value: 1 } }]
  if (Object.hasOwn(FIXED_KEYS, key)) {
    return [{ kind: 'fixed', fixed: { path, value: FIXED_KEYS[key] } }]
  }
  const spec = toSettingSpec(doc, field)
  return spec ? [{ kind: 'setting', key, path, spec }] : []
}

function settingsAt(
  doc: OpenApiDoc,
  request: JsonSchema,
  source: SettingSource
): Found[] {
  const container = schemaAt(doc, request, source.root)
  if (!container) return []
  const required = new Set(container.required ?? [])
  return propertiesOf(container).flatMap(([name, schema]) =>
    classify(doc, source, { name, schema, required: required.has(name) })
  )
}

function nameOf(found: FoundSetting, counts: Record<string, number>): string {
  return counts[found.key] > 1 && found.path ? found.path.join('.') : found.key
}

export function deriveSettings(
  doc: OpenApiDoc,
  request: JsonSchema,
  sources: readonly SettingSource[],
  extras: readonly ExtraSetting[] = []
): DerivedSettings {
  const found = sources.flatMap((source) => settingsAt(doc, request, source))
  const settings: FoundSetting[] = [
    ...found.flatMap((entry) => (entry.kind === 'setting' ? [entry] : [])),
    ...extras.map(({ spec, path }) => ({ key: spec.name, path, spec }))
  ]
  const counts = countBy(settings, (entry) => entry.key)
  const named = settings.map((entry) => {
    const name = nameOf(entry, counts)
    return { name, path: entry.path, spec: { ...entry.spec, name } }
  })
  return {
    settings: sortBy(named, [({ spec }) => CONTROL_ORDER[spec.control]]).map(
      ({ spec }) => spec
    ),
    settingPaths: Object.fromEntries(
      named.flatMap(({ name, path }) => (path ? [[name, path]] : []))
    ),
    fixed: found.flatMap((entry) =>
      entry.kind === 'fixed' ? [entry.fixed] : []
    )
  }
}
