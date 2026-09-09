import { realpathSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { workshopDisplaySchema } from '../src/content/workshop-display.schema'
import type { WorkshopDisplayEntry } from '../src/content/workshop-display.schema'

/**
 * The display overlay, packed the same way as the catalog: one JSON array,
 * one model per line, written by a script and read only by Zod and
 * `getCollection()`. See `generate-workshop-catalog.ts` for why.
 */
const OVERLAY = resolve(
  import.meta.dirname,
  '../src/content/workshop-display.json'
)

/** The catalog this overlay must line up with. */
const CATALOG = resolve(
  import.meta.dirname,
  '../src/content/workshop-models.json'
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The content side delivers one object keyed by model id, with its own copy of
 * some catalog fields under underscore names. The collection wants that key as
 * a field, so this is where the two shapes meet.
 */
function project(modelId: string, value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    id: modelId,
    media: value.media ?? {},
    // Delivered as `null` rather than omitted when a model has no example.
    examples: value.examples ?? [],
    pricing: value.pricing ?? null,
    status: value.status ?? 'active',
    useCases: value.useCases ?? [],
    license: value.license ?? null,
    mediaConfidence: value._mediaConfidence,
    needsReview: value._needsReview
  }
}

export function buildWorkshopDisplay(
  input: unknown,
  catalogIds: ReadonlySet<string>
): WorkshopDisplayEntry[] {
  if (!isRecord(input)) {
    throw new Error('Display overlay is not an object keyed by model id')
  }

  const overlay = Object.entries(input).map(([modelId, value]) => {
    const parsed = workshopDisplaySchema.safeParse(project(modelId, value))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(
        `Invalid display entry for ${modelId}: ${issue.path.join('.')} ${issue.message}`
      )
    }
    return parsed.data
  })

  // An overlay entry for a model the catalog does not have would render
  // nowhere; a catalog model with no overlay entry is expected while the
  // content pass is in progress. Only the first is an error.
  const orphans = overlay
    .map((entry) => entry.id)
    .filter((id) => !catalogIds.has(id))
  if (orphans.length > 0) {
    throw new Error(
      `Display overlay names ${orphans.length} model(s) absent from the catalog: ${orphans.slice(0, 3).join(', ')}`
    )
  }

  // An example is meant to be loaded into the form and its output shown
  // beside it, paired by index. More examples than samples would leave an
  // example with no output; the reverse is fine and common — 7 models have a
  // sample with nothing to prefill.
  for (const entry of overlay) {
    const samples = entry.media.samples?.length ?? 0
    if (entry.examples.length > samples) {
      throw new Error(
        `${entry.id} has ${entry.examples.length} example(s) but only ${samples} sample(s); they pair by index`
      )
    }
  }

  // Sorted by model id, not by locale, so the committed file does not churn
  // with the generator host's locale.
  return overlay.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

async function catalogModelIds(): Promise<Set<string>> {
  const raw = JSON.parse(await readFile(CATALOG, 'utf8')) as unknown
  if (!Array.isArray(raw)) throw new Error('Catalog is not an array')
  return new Set(
    raw
      .map((model) => (isRecord(model) ? String(model.id) : ''))
      .filter(Boolean)
  )
}

async function main(): Promise<void> {
  const dropPath = process.argv[2]
  if (!dropPath) {
    throw new Error(
      'Usage: pnpm generate:workshop-display /path/to/workshop-display.json'
    )
  }

  const drop = JSON.parse(await readFile(resolve(dropPath), 'utf8')) as unknown
  const overlay = buildWorkshopDisplay(drop, await catalogModelIds())

  const next = `[\n${overlay.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`
  const previous = await readFile(OVERLAY, 'utf8').catch(() => undefined)
  if (previous !== next) await writeFile(OVERLAY, next)

  const withThumb = overlay.filter((e) => e.media.thumbnail).length
  const withExample = overlay.filter((e) => e.examples.length > 0).length
  process.stdout.write(
    `workshop-display: ${overlay.length} entries, ${withThumb} thumbnails, ${withExample} examples\n`
  )
}

// Run only when invoked directly, so the builder above stays importable by the
// tests without the script writing anything.
if (realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  await main()
}
