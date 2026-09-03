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

  return {
    id: value.id,
    slug: slugFor(value.id),
    displayName: value.display_name,
    provider: value.provider,
    modality: value.type,
    description: value.description,
    tags: value.tags,
    parameters: value.parameters,
    roles: roles.filter((role): role is MediaRole => role !== undefined)
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
