import type { WorkshopModelEntry } from '../content/workshop-models.schema'

type MediaRole = WorkshopModelEntry['roles'][number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

type FieldOption = string | number

export type WorkshopCatalogField =
  | {
      readonly kind: 'text'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly multiline: boolean
      readonly valueType: 'string' | 'json'
      readonly defaultValue?: string
      /** Values the schema names without restricting the field to them. */
      readonly suggestions?: readonly FieldOption[]
    }
  | {
      readonly kind: 'select'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly options: readonly FieldOption[]
      readonly defaultValue?: FieldOption
    }
  | {
      readonly kind: 'number'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly integer: boolean
      readonly min?: number
      readonly max?: number
      readonly step: number | 'any'
      readonly defaultValue?: number
    }
  | {
      readonly kind: 'toggle'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly required: boolean
      readonly defaultValue: boolean
    }
  | {
      readonly kind: 'media'
      readonly name: string
      readonly role: string
      readonly label: string
      readonly required: boolean
      readonly multiple: boolean
      readonly accept: 'image' | 'video' | 'audio' | 'file'
    }

function labelFor(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function hintFor(schema: Record<string, unknown>): { readonly hint?: string } {
  return typeof schema.description === 'string'
    ? { hint: schema.description }
    : {}
}

function primitiveOptions(schema: Record<string, unknown>): FieldOption[] {
  if (Array.isArray(schema.enum)) {
    return schema.enum.filter(
      (value): value is FieldOption =>
        typeof value === 'string' || typeof value === 'number'
    )
  }
  if (!Array.isArray(schema.anyOf)) return []
  return schema.anyOf.flatMap((variant) =>
    isRecord(variant) ? primitiveOptions(variant) : []
  )
}

/**
 * True when a schema lists some values but also accepts anything of that
 * type: `anyOf: [{enum: [...]}, {type: 'string'}]`.
 *
 * ElevenLabs and Fish Audio `voice`, and HeyGen `avatar_id`, are all this
 * shape - pick a stock one, or paste the id of one you cloned yourself.
 * Rendering it as a closed select makes your own voice unreachable, so the
 * listed values become suggestions on a text field instead.
 */
function acceptsAnyValue(schema: Record<string, unknown>): boolean {
  if (!Array.isArray(schema.anyOf)) return false
  return schema.anyOf.some(
    (variant) =>
      isRecord(variant) &&
      variant.enum === undefined &&
      (variant.type === 'string' ||
        variant.type === 'number' ||
        variant.type === 'integer')
  )
}

function fieldFor(
  name: string,
  schema: Record<string, unknown>,
  required: boolean
): WorkshopCatalogField {
  const common = {
    name,
    label: labelFor(name),
    ...hintFor(schema),
    required
  }
  const options = primitiveOptions(schema)
  if (options.length > 0 && acceptsAnyValue(schema)) {
    return {
      kind: 'text',
      ...common,
      multiline: false,
      valueType: 'string',
      suggestions: options,
      ...(typeof schema.default === 'string'
        ? { defaultValue: schema.default }
        : {})
    }
  }
  if (options.length > 0) {
    const defaultValue =
      typeof schema.default === 'string' || typeof schema.default === 'number'
        ? schema.default
        : undefined
    return {
      kind: 'select',
      ...common,
      options,
      ...(defaultValue === undefined ? {} : { defaultValue })
    }
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    return {
      kind: 'number',
      ...common,
      integer: schema.type === 'integer',
      ...(typeof schema.minimum === 'number' ? { min: schema.minimum } : {}),
      ...(typeof schema.maximum === 'number' ? { max: schema.maximum } : {}),
      // Only the schema may narrow precision. A float that does not declare
      // multipleOf accepts any value, and a hard-coded 0.01 silently made
      // 73 fields reject inputs the provider allows.
      step:
        typeof schema.multipleOf === 'number'
          ? schema.multipleOf
          : schema.type === 'integer'
            ? 1
            : 'any',
      ...(typeof schema.default === 'number'
        ? { defaultValue: schema.default }
        : {})
    }
  }
  if (schema.type === 'boolean') {
    return {
      kind: 'toggle',
      ...common,
      defaultValue: typeof schema.default === 'boolean' ? schema.default : false
    }
  }
  if (schema.type === 'string') {
    return {
      kind: 'text',
      ...common,
      multiline:
        name === 'prompt' ||
        (typeof schema.maxLength === 'number' && schema.maxLength > 200),
      valueType: 'string',
      ...(typeof schema.default === 'string'
        ? { defaultValue: schema.default }
        : {})
    }
  }
  return {
    kind: 'text',
    ...common,
    multiline: true,
    valueType: 'json',
    ...(schema.default === undefined
      ? {}
      : { defaultValue: JSON.stringify(schema.default, null, 2) })
  }
}

function acceptFor(role: string): 'image' | 'video' | 'audio' | 'file' {
  if (role.includes('image') || role === 'mask') return 'image'
  if (role.includes('video')) return 'video'
  if (role.includes('audio')) return 'audio'
  return 'file'
}

export function deriveWorkshopFields(
  parameters: WorkshopModelEntry['parameters'],
  roles: readonly MediaRole[]
): WorkshopCatalogField[] {
  const properties = isRecord(parameters.properties)
    ? parameters.properties
    : {}
  const required = new Set(
    isStringArray(parameters.required) ? parameters.required : []
  )
  const fields = Object.entries(properties).flatMap(([name, schema]) => {
    if (
      name === 'model' ||
      name === 'medias' ||
      name === 'dispatch_mode' ||
      !isRecord(schema)
    ) {
      return []
    }
    return [fieldFor(name, schema, required.has(name))]
  })
  return [
    ...fields,
    ...roles.map(
      (role): WorkshopCatalogField => ({
        kind: 'media',
        name: `media_${role.role}`,
        role: role.role,
        label: labelFor(role.role),
        required: role.required,
        multiple: role.cardinality === 'many',
        accept: acceptFor(role.role)
      })
    )
  ]
}
