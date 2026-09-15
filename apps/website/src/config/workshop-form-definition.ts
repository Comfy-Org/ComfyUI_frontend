import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { GeneratedField } from './models-catalogue'
import type { WorkshopMediaBinding } from './workshop-contract'
import { deriveWorkshopFields } from './workshop-fields'
import { pointerKeys } from './workshop-json-pointer'
import { resolveSchemaReference } from './workshop-router-openapi'
import type { WorkshopInputDefinition } from './workshop-input-definition'
import type { WorkshopCreatorFile } from './workshop-creator-form'

export interface WorkshopFormDefinition {
  readonly source?: 'router'
  readonly raw?: boolean
  readonly parameters: WorkshopModelEntry['parameters']
  readonly roles: WorkshopModelEntry['roles']
  readonly advancedFields: readonly string[]
  readonly media?: readonly WorkshopMediaBinding[]
  readonly files?: readonly WorkshopCreatorFile[]
  readonly inputs?: Readonly<Record<string, WorkshopInputDefinition>>
}

export function usesRequestBodyEditor(
  definition: WorkshopFormDefinition
): boolean {
  if (definition.source !== 'router') return false
  const schema = definition.parameters
  return (
    definition.raw === true ||
    ['allOf', 'anyOf', 'oneOf'].some((key) => Array.isArray(schema[key])) ||
    (definition.inputs === undefined &&
      (!schema.properties || Object.keys(schema.properties).length === 0))
  )
}

const definitions = new WeakMap<WorkshopFormDefinition, GeneratedField[]>()

export function fieldsForDefinition(
  definition: WorkshopFormDefinition
): GeneratedField[] {
  const cached = definitions.get(definition)
  if (cached) return cached
  const fields = deriveFieldsForDefinition(definition)
  definitions.set(definition, fields)
  return fields
}

function deriveFieldsForDefinition(
  definition: WorkshopFormDefinition
): GeneratedField[] {
  const {
    parameters,
    roles,
    advancedFields,
    media = [],
    files = []
  } = definition
  const rawProperties = parameters.properties
  const properties =
    rawProperties &&
    typeof rawProperties === 'object' &&
    !Array.isArray(rawProperties)
      ? Object.fromEntries(
          Object.entries(rawProperties).map(([name, value]) => [
            name,
            value && typeof value === 'object' && !Array.isArray(value)
              ? resolveSchemaReference(value, parameters)
              : value
          ])
        )
      : {}
  const fields = deriveWorkshopFields(
    { ...parameters, properties },
    roles,
    definition.source === 'router' ? [] : undefined
  ).filter((field) => !definition.inputs?.[field.name]?.hidden)
  const bodyEditor = usesRequestBodyEditor(definition)
  const names = new Set([
    ...fields.map((field) => field.name),
    ...media.map((field) => field.name),
    ...files.map((field) => field.name)
  ])
  const stale = advancedFields.filter((name) => !names.has(name))
  if (!bodyEditor && stale.length)
    throw new Error(`Unknown Advanced fields: ${stale.join(', ')}`)
  if (
    new Set(media.map((field) => field.name)).size !== media.length ||
    media.some((binding) => fields.some((field) => field.name === binding.name))
  )
    throw new Error('Duplicate media form field')
  const advanced = new Map(advancedFields.map((name, index) => [name, index]))
  const mediaRoots = new Set(
    media.flatMap((binding) =>
      binding.targets.map((path) => pointerKeys(path)[0])
    )
  )
  const presentation = (name: string) => {
    const advancedIndex = advanced.get(name)
    const input =
      definition.inputs && Object.hasOwn(definition.inputs, name)
        ? definition.inputs[name]
        : undefined
    return {
      advanced: advancedIndex !== undefined,
      ...(advancedIndex === undefined ? {} : { advancedIndex }),
      ...(input
        ? { label: input.label, hint: input.help, presentation: input }
        : {})
    }
  }
  const rendered: GeneratedField[] = bodyEditor
    ? [
        {
          kind: 'text',
          name: 'request_body',
          label: 'Request Body',
          multiline: true,
          required: media.length === 0,
          valueType: 'json',
          jsonSchema: media.length ? {} : parameters,
          ...(media.length ? { default: '{}' } : { inputSchema: parameters }),
          ...(definition.inputs === undefined &&
          typeof parameters.description === 'string'
            ? { hint: parameters.description }
            : {})
        }
      ]
    : fields.map((field): GeneratedField => {
        if (field.kind === 'media')
          return { ...field, ...presentation(field.name), kind: 'file' }
        const property = properties[field.name]
        const inputSchema =
          !mediaRoots.has(field.name) &&
          property &&
          typeof property === 'object' &&
          !Array.isArray(property)
            ? {
                ...property,
                ...(parameters.components
                  ? { components: parameters.components }
                  : {})
              }
            : undefined
        const common = {
          ...presentation(field.name),
          ...(mediaRoots.has(field.name) ? { required: false } : {}),
          ...(inputSchema ? { inputSchema } : {})
        }
        switch (field.kind) {
          case 'text':
            return {
              ...field,
              ...common,
              default: field.defaultValue,
              ...(field.valueType === 'string' && common.presentation
                ? { multiline: common.presentation.control === 'text-area' }
                : {}),
              ...(field.valueType === 'json'
                ? { jsonSchema: inputSchema ?? {} }
                : {})
            }
          case 'number':
            return { ...field, ...common, default: field.defaultValue }
          case 'select':
            return { ...field, ...common, default: field.defaultValue }
          case 'toggle':
            return { ...field, ...common, default: field.defaultValue }
        }
      })
  return [
    ...rendered,
    ...media.map(
      (binding): GeneratedField => ({
        kind: 'file',
        name: binding.name,
        label: binding.label,
        accept: binding.accept,
        required: binding.required,
        multiple: binding.targets.length > 1,
        maxItems: binding.targets.length,
        ...presentation(binding.name)
      })
    ),
    ...files.map(
      (file): GeneratedField => ({
        kind: 'file',
        ...file,
        multiple: file.maxItems > 1,
        ...presentation(file.name)
      })
    )
  ]
}
