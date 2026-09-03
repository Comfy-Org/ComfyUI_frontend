import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUTPUT = resolve(
  import.meta.dirname,
  '../src/config/workshop-catalog.generated.json'
)

const MODALITIES = ['image', 'video', 'audio', 'music', '3d', 'svg'] as const

type Modality = (typeof MODALITIES)[number]

interface MediaRole {
  readonly role: string
  readonly required: boolean
  readonly cardinality: 'single' | 'many'
  readonly minItems: number
  readonly maxItems?: number
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
      readonly step: number
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
      readonly label: string
      readonly required: boolean
      readonly multiple: boolean
      readonly accept: 'image' | 'video' | 'audio' | 'file'
    }

export interface WorkshopCatalogModel {
  readonly id: string
  readonly slug: string
  readonly displayName: string
  readonly provider: string
  readonly modality: Modality
  readonly description: string
  readonly tags: readonly string[]
  readonly parameters: Readonly<Record<string, unknown>>
  readonly roles: readonly MediaRole[]
  readonly fields: readonly WorkshopCatalogField[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isModality(value: unknown): value is Modality {
  return MODALITIES.some((modality) => modality === value)
}

function decodeRole(value: unknown): MediaRole | undefined {
  if (
    !isRecord(value) ||
    typeof value.role !== 'string' ||
    typeof value.required !== 'boolean' ||
    (value.cardinality !== 'single' && value.cardinality !== 'many') ||
    typeof value.minItems !== 'number' ||
    (value.maxItems !== undefined && typeof value.maxItems !== 'number')
  ) {
    return undefined
  }

  return {
    role: value.role,
    required: value.required,
    cardinality: value.cardinality,
    minItems: value.minItems,
    ...(value.maxItems === undefined ? {} : { maxItems: value.maxItems })
  }
}

function slugFor(id: string): string {
  return id.replaceAll('/', '--')
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
      step:
        typeof schema.multipleOf === 'number'
          ? schema.multipleOf
          : schema.type === 'integer'
            ? 1
            : 0.01,
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
  parameters: Readonly<Record<string, unknown>>,
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
        name: role.role,
        label: labelFor(role.role),
        required: role.required,
        multiple: role.cardinality === 'many',
        accept: acceptFor(role.role)
      })
    )
  ]
}

function decodeModel(value: unknown): WorkshopCatalogModel | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.display_name !== 'string' ||
    typeof value.provider !== 'string' ||
    !isModality(value.type) ||
    typeof value.description !== 'string' ||
    !isStringArray(value.tags) ||
    !isRecord(value.parameters) ||
    !Array.isArray(value.roles)
  ) {
    return undefined
  }

  const roles = value.roles.map(decodeRole)
  if (roles.some((role) => role === undefined)) return undefined

  const parameters = value.parameters
  const decodedRoles = roles.filter(
    (role): role is MediaRole => role !== undefined
  )
  return {
    id: value.id,
    slug: slugFor(value.id),
    displayName: value.display_name,
    provider: value.provider,
    modality: value.type,
    description: value.description,
    tags: value.tags,
    parameters,
    roles: decodedRoles,
    fields: deriveWorkshopFields(parameters, decodedRoles)
  }
}

export function buildWorkshopCatalog(input: unknown): WorkshopCatalogModel[] {
  if (!Array.isArray(input))
    throw new Error('Partner model export is not a list')

  const decoded = input.map(decodeModel)
  const invalid = decoded.flatMap((model, index) =>
    model === undefined ? [index] : []
  )
  if (invalid.length > 0) {
    throw new Error(`Invalid partner models at indexes: ${invalid.join(', ')}`)
  }

  const catalog = decoded.filter(
    (model): model is WorkshopCatalogModel => model !== undefined
  )
  const ids = new Set(catalog.map((model) => model.id))
  const slugs = new Set(catalog.map((model) => model.slug))
  if (ids.size !== catalog.length) throw new Error('Duplicate partner model id')
  if (slugs.size !== catalog.length) throw new Error('Duplicate Workshop slug')

  return catalog.sort((a, b) => a.id.localeCompare(b.id))
}

async function loadModels(modulePath: string): Promise<unknown> {
  const module = (await import(pathToFileURL(modulePath).href)) as {
    readonly models?: unknown
  }
  return module.models
}

async function main(): Promise<void> {
  const modulePath = process.argv[2]
  const sourceRef = process.argv[3]
  if (!modulePath || !sourceRef) {
    throw new Error(
      'Usage: pnpm generate:workshop-catalog /path/to/partner-client.mjs <source-commit>'
    )
  }

  const catalog = buildWorkshopCatalog(await loadModels(resolve(modulePath)))
  const previous = await readFile(OUTPUT, 'utf8').catch(() => undefined)
  const next = `${JSON.stringify({ sourceRef, models: catalog }, null, 2)}\n`
  if (previous !== next) await writeFile(OUTPUT, next)
}

if (process.argv[1] === import.meta.filename) await main()
