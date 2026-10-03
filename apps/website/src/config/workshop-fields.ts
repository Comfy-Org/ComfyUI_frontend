import type { WorkshopModelEntry } from '../content/workshop-models.schema'

type MediaRole = WorkshopModelEntry['roles'][number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

type FieldOption = string | number | boolean

interface WorkshopTextFieldBase {
  readonly kind: 'text'
  readonly name: string
  readonly label: string
  readonly hint?: string
  readonly required: boolean
  readonly multiline: boolean
  readonly minLength?: number
  readonly maxLength?: number
  readonly defaultValue?: string
  /** Values the schema names without restricting the field to them. */
  readonly suggestions?: readonly FieldOption[]
}

export type WorkshopCatalogField =
  | (WorkshopTextFieldBase & {
      readonly valueType: 'string'
      readonly jsonSchema?: never
    })
  | (WorkshopTextFieldBase & {
      readonly valueType: 'json'
      /** Authoritative Router schema used to validate the parsed value. */
      readonly jsonSchema: Readonly<Record<string, unknown>>
    })
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
      readonly defaultValue?: boolean
    }
  | {
      readonly kind: 'media'
      readonly name: string
      readonly role: string
      readonly label: string
      readonly required: boolean
      readonly multiple: boolean
      readonly maxItems?: number
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
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    )
  }
  if (!Array.isArray(schema.anyOf)) return []
  return schema.anyOf.flatMap((variant) =>
    isRecord(variant) ? primitiveOptions(variant) : []
  )
}

/**
 * Finds the string variant when a schema lists some values but also accepts
 * any string: `anyOf: [{enum: [...]}, {type: 'string'}]`.
 *
 * ElevenLabs and Fish Audio `voice`, and HeyGen `avatar_id`, are all this
 * shape - pick a stock one, or paste the id of one you cloned yourself.
 * Rendering it as a closed select makes your own voice unreachable, so the
 * listed values become suggestions on a text field instead.
 */
function openStringVariant(
  schema: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (Array.isArray(schema.enum) || !Array.isArray(schema.anyOf))
    return undefined
  return schema.anyOf.find(
    (variant): variant is Record<string, unknown> =>
      isRecord(variant) &&
      variant.enum === undefined &&
      variant.type === 'string'
  )
}

function textLengthLimits(schema: Record<string, unknown>): {
  readonly minLength?: number
  readonly maxLength?: number
} {
  return {
    ...(typeof schema.minLength === 'number'
      ? { minLength: schema.minLength }
      : {}),
    ...(typeof schema.maxLength === 'number'
      ? { maxLength: schema.maxLength }
      : {})
  }
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
  const openString = openStringVariant(schema)
  if (options.length > 0 && openString) {
    const textSchema = { ...schema, ...openString }
    return {
      kind: 'text',
      ...common,
      multiline: false,
      valueType: 'string',
      ...textLengthLimits(textSchema),
      suggestions: options,
      ...(typeof schema.default === 'string'
        ? { defaultValue: schema.default }
        : {})
    }
  }
  if (options.length > 0) {
    const defaultValue =
      typeof schema.default === 'string' ||
      typeof schema.default === 'number' ||
      typeof schema.default === 'boolean'
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
      ...(typeof schema.default === 'boolean'
        ? { defaultValue: schema.default }
        : {})
    }
  }
  if (schema.type === 'string') {
    return {
      kind: 'text',
      ...common,
      // A bound above 200 means long prose. So does no bound at all, which
      // is the common case: every `negative_prompt` in the catalog is an
      // unbounded string, and testing `maxLength > 200` alone put 135 of 332
      // free-text fields into a single-line box.
      multiline:
        typeof schema.maxLength === 'number' ? schema.maxLength > 200 : true,
      valueType: 'string',
      ...textLengthLimits(schema),
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
    jsonSchema: schema,
    ...(schema.default === undefined
      ? {}
      : { defaultValue: JSON.stringify(schema.default, null, 2) })
  }
}

/**
 * Which file types a media input should accept.
 *
 * `view_*` roles are named for the camera angle rather than the medium, so a
 * substring match alone drops them to a generic file picker. Four models
 * carry them, and `kling/dual-character-effect` has nothing but `view_left`
 * and `view_right`, so it would offer no image picker at all.
 */
function acceptFor(role: string): 'image' | 'video' | 'audio' | 'file' {
  if (role.startsWith('view_')) return 'image'
  if (role.includes('image') || role === 'mask') return 'image'
  if (role.includes('video')) return 'video'
  if (role.includes('audio')) return 'audio'
  return 'file'
}

export function deriveWorkshopFields(
  parameters: WorkshopModelEntry['parameters'],
  roles: readonly MediaRole[],
  omittedFields: readonly string[] = ['model', 'medias', 'dispatch_mode']
): WorkshopCatalogField[] {
  const properties = isRecord(parameters.properties)
    ? parameters.properties
    : {}
  const required = new Set(
    isStringArray(parameters.required) ? parameters.required : []
  )
  const fields = Object.entries(properties).flatMap(([name, schema]) => {
    if (omittedFields.includes(name) || !isRecord(schema)) {
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
        ...(role.maxItems === undefined ? {} : { maxItems: role.maxItems }),
        accept: acceptFor(role.role)
      })
    )
  ]
}
