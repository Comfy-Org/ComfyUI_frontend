import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { workshopModelSchema } from '../src/content/workshop-models.schema'
import type { WorkshopModelEntry } from '../src/content/workshop-models.schema'

/** One file per model, loaded as an Astro content collection. */
const COLLECTION_DIR = resolve(
  import.meta.dirname,
  '../src/content/workshop-models'
)

/** Everything about the snapshot that is not about one model. */
const MANIFEST = resolve(
  import.meta.dirname,
  '../src/config/workshop-catalog.manifest.json'
)

function slugFor(id: string): string {
  return id.replaceAll('/', '--')
}

/**
 * The partner client speaks snake_case and calls modality `type`; the
 * collection speaks camelCase. This is the only place the two meet.
 */
function project(value: unknown): unknown {
  const source = value as Record<string, unknown>
  return {
    id: source.id,
    slug: typeof source.id === 'string' ? slugFor(source.id) : source.id,
    displayName: source.display_name,
    provider: source.provider,
    modality: source.type,
    description: source.description,
    tags: source.tags,
    parameters: source.parameters,
    roles: Array.isArray(source.roles)
      ? source.roles.map((role) => {
          if (typeof role !== 'object' || role === null) return role
          const { extras, ...rest } = role as Record<string, unknown>
          // Keep `extras` only where the provider actually populated it, so
          // 288 roles do not each carry an empty array.
          return Array.isArray(extras) && extras.length > 0
            ? { ...rest, extras }
            : rest
        })
      : source.roles
  }
}

export function buildWorkshopCatalog(input: unknown): WorkshopModelEntry[] {
  if (!Array.isArray(input))
    throw new Error('Partner model export is not a list')

  // Zod is the boundary. A malformed model fails here, naming the model and
  // the field, rather than being silently dropped or reaching the site.
  const catalog = input.map((value, index) => {
    const parsed = workshopModelSchema.safeParse(project(value))
    if (!parsed.success) {
      const id = (value as { id?: unknown })?.id
      throw new Error(
        `Invalid partner model at index ${index}${typeof id === 'string' ? ` (${id})` : ''}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')} ${issue.message}`)
          .join('; ')}`
      )
    }
    return parsed.data
  })

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
  await writeCollection(catalog, sourceRef)
}

/**
 * Writes one file per model and prunes any model the source no longer has,
 * so a removed model leaves the collection instead of lingering as a page
 * nothing links to. Files are only rewritten when their content changes,
 * which keeps an unrelated regeneration out of the diff.
 */
async function writeCollection(
  catalog: readonly WorkshopModelEntry[],
  sourceRef: string
): Promise<void> {
  await mkdir(COLLECTION_DIR, { recursive: true })

  const keep = new Set(catalog.map((model) => `${model.slug}.json`))
  const existing = await readdir(COLLECTION_DIR).catch(() => [] as string[])
  for (const file of existing) {
    if (file.endsWith('.json') && !keep.has(file)) {
      await rm(join(COLLECTION_DIR, file))
    }
  }

  for (const model of catalog) {
    const path = join(COLLECTION_DIR, `${model.slug}.json`)
    const next = `${JSON.stringify(model, null, 2)}\n`
    const previous = await readFile(path, 'utf8').catch(() => undefined)
    if (previous !== next) await writeFile(path, next)
  }

  const manifest = `${JSON.stringify({ sourceRef, modelCount: catalog.length }, null, 2)}\n`
  const previousManifest = await readFile(MANIFEST, 'utf8').catch(
    () => undefined
  )
  if (previousManifest !== manifest) await writeFile(MANIFEST, manifest)
}

if (process.argv[1] === import.meta.filename) await main()
