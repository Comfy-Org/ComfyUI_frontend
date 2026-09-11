import { z } from 'astro/zod'

import rawPresentation from '../src/data/workshop-input-presentation.json'
import type { WorkshopModelEntry } from '../src/content/workshop-models.schema'
import { deriveWorkshopFields } from '../src/config/workshop-fields'
import { workshopInputDefinitionSchema } from '../src/config/workshop-input-definition'
import type { WorkshopInputDefinition } from '../src/config/workshop-input-definition'
import { validateWorkshopInput } from '../src/config/workshop-json-schema'
import { resolveSchemaReference } from '../src/config/workshop-router-openapi'

const jsonObject = z.record(z.string(), z.json())
const scalar = z.union([z.string(), z.number(), z.boolean()])
const ruleSchema = workshopInputDefinitionSchema
  .omit({ defaultSource: true })
  .partial()
  .extend({
    options: z.array(scalar).min(1).optional(),
    default: z.json().optional(),
    fixed: scalar.optional(),
    defaultPolicy: z.literal('required-only').optional(),
    defaultCandidates: z.array(scalar).optional()
  })
  .strict()
const presentation = z
  .object({
    common: z.array(ruleSchema.extend({ names: z.array(z.string()).min(1) })),
    models: z.record(z.string(), z.record(z.string(), ruleSchema))
  })
  .parse(rawPresentation)
const commonRules = new Map(
  presentation.common.flatMap((rule) =>
    rule.names.map((name) => [name, rule] as const)
  )
)
if (
  commonRules.size !==
  presentation.common.reduce((count, rule) => count + rule.names.length, 0)
)
  throw new Error('Duplicate common input presentation names')
const modelRules = new Map(Object.entries(presentation.models))

type JsonSchema = WorkshopModelEntry['parameters']

function friendlyLabel(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(
    /\b(url|id|json|fps|pbr)\b/gi,
    (word) => word.toUpperCase()
  )
}

function durationOptions(schema: JsonSchema): number[] | undefined {
  if (schema.type !== 'integer' || Array.isArray(schema.enum)) return undefined
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf : [schema]
  const bounds = variants.flatMap((variant) => {
    const parsed = jsonObject.safeParse(variant)
    if (!parsed.success) return []
    const { minimum, maximum } = parsed.data
    return typeof minimum === 'number' && typeof maximum === 'number'
      ? [{ minimum, maximum }]
      : []
  })
  if (
    !bounds.length ||
    bounds.some(({ minimum, maximum }) => minimum < 0 || maximum > 120)
  )
    return undefined
  const minimum = Math.min(...bounds.map((bound) => bound.minimum))
  const maximum = Math.max(...bounds.map((bound) => bound.maximum))
  const options = [
    ...(validateWorkshopInput(-1, schema) ? [-1] : []),
    ...Array.from(
      { length: Math.floor(maximum) - Math.ceil(minimum) + 1 },
      (_, index) => Math.ceil(minimum) + index
    ).filter((value) => validateWorkshopInput(value, schema))
  ]
  return options.length ? options : undefined
}

function controlFor(
  name: string,
  schema: JsonSchema,
  preferred?: WorkshopInputDefinition['control']
): WorkshopInputDefinition['control'] {
  const [field] = deriveWorkshopFields(
    { type: 'object', properties: { [name]: schema } },
    [],
    []
  )
  switch (field.kind) {
    case 'select':
      return 'dropdown'
    case 'toggle':
      return 'toggle'
    case 'number':
      return preferred !== 'number' &&
        field.min !== undefined &&
        field.max !== undefined &&
        field.min < field.max
        ? 'slider'
        : 'number'
    case 'media':
      return 'media'
    case 'text':
      if (field.valueType === 'json' && preferred === 'dialogue')
        return 'dialogue'
      if (field.valueType === 'json') return 'text-area'
      if (preferred === 'text-box' || preferred === 'text-area')
        return preferred
      return 'text-box'
  }
}

export function curateWorkshopInputs(
  id: string,
  source: JsonSchema,
  omitted: readonly string[] = [],
  customRules?: Readonly<Record<string, z.infer<typeof ruleSchema>>>
) {
  const properties = jsonObject.parse(source.properties ?? {})
  const required = new Set(
    Array.isArray(source.required) ? source.required : []
  )
  const overrides = new Map(
    Object.entries(customRules ?? modelRules.get(id) ?? {})
  )
  for (const name of [...omitted, ...overrides.keys()])
    if (!Object.hasOwn(properties, name))
      throw new Error(`Unknown curated input ${id}:${name}`)
  const hidden = new Set(omitted)
  const unsetDefaults = new Set<string>()
  const inputs: Record<string, WorkshopInputDefinition> = {}
  const defaultInput: JsonSchema = {}
  const curated = Object.entries(properties).map(([name, raw]) => {
    const schema = resolveSchemaReference(jsonObject.parse(raw), source)
    const common = commonRules.get(name)
    const override = overrides.get(name)
    const rule = { ...common, ...override }
    if (rule.fixed !== undefined) {
      if (
        !validateWorkshopInput(rule.fixed, {
          ...schema,
          ...(source.components ? { components: source.components } : {})
        })
      )
        throw new Error(`Invalid fixed input ${id}:${name}`)
      defaultInput[name] = rule.fixed
      inputs[name] = {
        label: rule.label ?? friendlyLabel(name),
        help: '',
        hidden: true,
        advanced: false,
        control: controlFor(name, schema),
        defaultSource: 'curated'
      }
      return [
        name,
        { ...schema, const: rule.fixed, default: rule.fixed }
      ] as const
    }
    if (!common && !override && !required.has(name) && !hidden.has(name)) {
      if (Object.hasOwn(schema, 'default')) {
        const validation = {
          ...schema,
          ...(source.components ? { components: source.components } : {})
        }
        if (!validateWorkshopInput(schema.default, validation))
          throw new Error(`Invalid Router default ${id}:${name}`)
        defaultInput[name] = schema.default
      }
      return [name, schema] as const
    }
    if (rule.hidden) hidden.add(name)
    if (hidden.has(name) && required.has(name))
      throw new Error(`Cannot hide required Router input ${id}:${name}`)
    const withComponents = {
      ...schema,
      ...(source.components ? { components: source.components } : {})
    }
    const options =
      override?.options ??
      (rule.unit === 'seconds' ? durationOptions(withComponents) : undefined)
    if (
      options?.some((option) => !validateWorkshopInput(option, withComponents))
    )
      throw new Error(`Invalid curated options ${id}:${name}`)
    const effective: JsonSchema = {
      ...schema,
      ...(options ? { enum: options } : {}),
      ...(rule.imageSource === 'url'
        ? {
            allOf: [
              ...(Array.isArray(schema.allOf) ? schema.allOf : []),
              { type: 'string', format: 'http-image-url' }
            ]
          }
        : {})
    }
    const validation = {
      ...effective,
      ...(source.components ? { components: source.components } : {})
    }
    let defaultSource: WorkshopInputDefinition['defaultSource']
    if (!hidden.has(name)) {
      if (rule.defaultPolicy === 'required-only' && !required.has(name)) {
        delete effective.default
        unsetDefaults.add(name)
      } else if (Object.hasOwn(schema, 'default')) {
        if (!validateWorkshopInput(schema.default, validation))
          throw new Error(`Invalid Router default ${id}:${name}`)
        defaultSource = 'router'
      } else if (override && Object.hasOwn(override, 'default')) {
        if (!validateWorkshopInput(override.default, validation))
          throw new Error(`Invalid curated default ${id}:${name}`)
        effective.default = z.json().parse(override.default)
        defaultSource = 'curated'
      } else {
        const choices =
          rule.defaultCandidates ??
          (Array.isArray(effective.enum) && effective.enum.length === 1
            ? effective.enum
            : [])
        const chosen = choices.find((value) =>
          validateWorkshopInput(value, validation)
        )
        if (chosen !== undefined) {
          effective.default = chosen
          defaultSource = 'curated'
        }
      }
    }
    const label = rule.label ?? friendlyLabel(name)
    inputs[name] = workshopInputDefinitionSchema.parse({
      label,
      help: rule.help ?? '',
      hidden: hidden.has(name),
      advanced: !hidden.has(name) && (rule.advanced ?? !required.has(name)),
      control: controlFor(name, effective, rule.control),
      ...(defaultSource ? { defaultSource } : {}),
      ...(rule.unit ? { unit: rule.unit } : {}),
      ...(rule.optionLabels ? { optionLabels: rule.optionLabels } : {}),
      ...(rule.imageSource ? { imageSource: rule.imageSource } : {}),
      ...(rule.urlUpload ? { urlUpload: rule.urlUpload } : {})
    })
    return [name, effective] as const
  })
  const inputSchema: JsonSchema = {
    ...source,
    ...(source.properties
      ? {
          properties: Object.fromEntries(
            curated.filter(([name]) => !hidden.has(name))
          )
        }
      : {}),
    ...(hidden.size
      ? {
          not: {
            anyOf: [
              ...(source.not ? [source.not] : []),
              ...[...hidden].map((name) => ({ required: [name] }))
            ]
          }
        }
      : {})
  }
  for (const key of ['example', 'default']) {
    const parsed = jsonObject.safeParse(source[key])
    if (parsed.success && source.properties)
      inputSchema[key] = {
        ...Object.fromEntries(
          Object.entries(parsed.data).filter(
            ([name]) =>
              Object.hasOwn(inputs, name) &&
              !hidden.has(name) &&
              (key !== 'default' || !unsetDefaults.has(name))
          )
        ),
        ...Object.fromEntries(
          Object.entries(defaultInput).filter(([name]) => inputs[name]?.hidden)
        )
      }
  }
  return { inputSchema, inputs, defaultInput }
}
