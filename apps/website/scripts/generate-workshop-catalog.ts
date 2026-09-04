import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { workshopModelSchema } from '../src/content/workshop-models.schema'
import type { WorkshopModelEntry } from '../src/content/workshop-models.schema'

/**
 * The whole catalog as one packed file, loaded by Astro's `file()` loader.
 *
 * One JSON array, one model per line. Nobody reads this: a script writes it,
 * the Zod schema validates it and `getCollection()` consumes it, so it is
 * sized for the repository rather than for a reader. Packed it is 270 lines
 * and 494 KB against 25,296 lines and 719 KB as a file per model.
 *
 * A line per model is what makes it a data file rather than a blob: adding a
 * model adds a line, dropping one removes a line, and a changed model is a
 * changed line. It is marked `linguist-generated` in `.gitattributes` so it
 * collapses in review, and excluded in `.oxfmtrc.json` so the formatter does
 * not unpack it back to one field per line.
 */
const CATALOG = resolve(
  import.meta.dirname,
  '../src/content/workshop-models.json'
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
  // Leave a non-record alone so it reaches the schema and produces the
  // contextual "invalid model at index N" error this function promises,
  // rather than throwing a bare TypeError on property access.
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }
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

  // Deliberately unsorted. Each model is its own file, so the only thing an
  // order could affect is the sequence of independent writes. `localeCompare`
  // was also host-dependent: `p/ä` and `p/z` swap between LANG=C and
  // LANG=sv_SE.UTF-8, which would churn the committed output.
  return catalog
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
  await writeCatalog(catalog, sourceRef)
}

/**
 * Writes the catalog as one packed array and the manifest beside it.
 *
 * A model the source no longer has simply is not written, so the file is the
 * snapshot rather than an accumulation -- there is nothing to prune, which is
 * what a file per model needed and could get wrong.
 *
 * Written only when the content differs, so an unrelated regeneration stays
 * out of the diff.
 */
async function writeCatalog(
  catalog: readonly WorkshopModelEntry[],
  sourceRef: string
): Promise<void> {
  const lines = catalog.map((model) => JSON.stringify(model))
  const next = `[\n${lines.join(',\n')}\n]\n`

  const previous = await readFile(CATALOG, 'utf8').catch(() => undefined)
  if (previous !== next) await writeFile(CATALOG, next)

  const manifest = `${JSON.stringify({ sourceRef, modelCount: catalog.length }, null, 2)}\n`
  const previousManifest = await readFile(MANIFEST, 'utf8').catch(
    () => undefined
  )
  if (previousManifest !== manifest) await writeFile(MANIFEST, manifest)
}

if (process.argv[1] === import.meta.filename) await main()
