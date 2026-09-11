import { realpathSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  workshopDisplayEntriesSchema,
  workshopDisplaySourceSchema
} from '../src/content/workshop-display.schema'
import type {
  WorkshopDisplayEntry,
  WorkshopDisplaySource
} from '../src/content/workshop-display.schema'
import type { WorkshopModelEntry } from '../src/content/workshop-models.schema'
import { workshopModelSchema } from '../src/content/workshop-models.schema'
import { deriveWorkshopFields } from '../src/config/workshop-fields'
import { workshopContract } from '../src/config/workshop-contract-catalog'
import { splitWorkshopDisplay } from './workshop-display-use-cases'
import { repairWorkshopExamples } from './workshop-example-repairs'

/**
 * The display overlay, packed the same way as the catalog: one JSON array,
 * one model/use-case entry per line, validated by Zod before the runtime join.
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
 * Preserve the prototype's current disclosure choices in explicit data.
 * The generated list is an initial editorial default: content can supply an
 * `advancedFields` list in a future drop to override it per model.
 */
export function deriveAdvancedFields(
  model: WorkshopModelEntry
): readonly string[] {
  const contract = workshopContract(model.id)
  if (contract) return contract.advancedFields
  const optional = deriveWorkshopFields(model.parameters, model.roles).filter(
    (field) =>
      !field.required && field.kind !== 'media' && field.kind !== 'text'
  )
  const preferred = [
    'width',
    'height',
    'resolution',
    'aspect_ratio',
    'size',
    'duration',
    'fps',
    'count'
  ]
  const settings = optional
    .filter((field) => field.kind !== 'toggle' && field.name !== 'seed')
    .sort(
      (a, b) =>
        (preferred.includes(a.name)
          ? preferred.indexOf(a.name)
          : preferred.length) -
        (preferred.includes(b.name)
          ? preferred.indexOf(b.name)
          : preferred.length)
    )
  return [
    ...settings.slice(3).map((field) => field.name),
    ...optional
      .filter((field) => field.kind === 'toggle' || field.name === 'seed')
      .map((field) => field.name)
  ]
}

/**
 * The content side delivers one object keyed by model id, with its own copy of
 * some catalog fields under underscore names. The collection wants that key as
 * a field, so this is where the two shapes meet.
 */
const IMAGE_EDIT_TAGS = new Set([
  'edit',
  'editing',
  'image-edit',
  'image-to-image',
  'image-to-svg',
  'inpaint',
  'outpaint',
  'upscale',
  'restore',
  'image-enhance'
])
const IMAGE_GENERATE_TAGS = new Set(['text-to-image', 'text-to-svg'])
const VIDEO_ANIMATE_TAGS = new Set([
  'image-to-video',
  'first-last-frame',
  'start-end-frame',
  'reference-to-video',
  'subject-to-video',
  'talking-image'
])
const VIDEO_GENERATE_TAGS = new Set(['text-to-video'])
const VIDEO_EDIT_TAGS = new Set([
  'video-edit',
  'video-to-video',
  'video-enhance',
  'continuation',
  'video-extend'
])

function hasAny(
  values: ReadonlySet<string>,
  tags: ReadonlySet<string>
): boolean {
  return [...values].some((value) => tags.has(value))
}

function isImageRole(role: string): boolean {
  return role.includes('image') || role === 'mask' || role.startsWith('view_')
}

export function deriveWorkshopUseCases(
  model: WorkshopModelEntry
): WorkshopDisplaySource['useCases'] {
  if (model.modality === 'audio' || model.modality === 'music') return ['audio']
  if (model.modality === '3d') return ['3d']

  const tags = new Set(model.tags)
  const requiredRoles = model.roles
    .filter((role) => role.required)
    .map((role) => role.role)

  if (model.modality === 'image' || model.modality === 'svg') {
    const useCases: Array<'generate-images' | 'edit-images'> = []
    if (hasAny(IMAGE_GENERATE_TAGS, tags)) useCases.push('generate-images')
    if (hasAny(IMAGE_EDIT_TAGS, tags) || requiredRoles.some(isImageRole)) {
      useCases.push('edit-images')
    }
    return useCases.length > 0 ? useCases : ['generate-images']
  }

  const useCases: Array<'animate-images' | 'generate-videos' | 'edit-videos'> =
    []
  if (hasAny(VIDEO_ANIMATE_TAGS, tags)) useCases.push('animate-images')
  if (hasAny(VIDEO_GENERATE_TAGS, tags)) useCases.push('generate-videos')
  if (
    hasAny(VIDEO_EDIT_TAGS, tags) ||
    requiredRoles.some((role) => role.includes('video'))
  ) {
    useCases.push('edit-videos')
  }
  if (useCases.length > 0) return useCases
  if (requiredRoles.some(isImageRole)) return ['animate-images']
  return ['generate-videos']
}

function project(
  modelId: string,
  value: unknown,
  catalogModel: WorkshopModelEntry
): unknown {
  if (!isRecord(value)) return value
  return {
    id: modelId,
    displayName:
      value.displayName ??
      (value._displayName === catalogModel.displayName
        ? undefined
        : value._displayName),
    media: value.media ?? {},
    // Delivered as `null` rather than omitted when a model has no example.
    examples: value.examples ?? [],
    advancedFields: value.advancedFields ?? deriveAdvancedFields(catalogModel),
    pricing: value.pricing ?? null,
    status: value.status ?? 'active',
    useCases:
      Array.isArray(value.useCases) && value.useCases.length === 0
        ? deriveWorkshopUseCases(catalogModel)
        : (value.useCases ?? deriveWorkshopUseCases(catalogModel)),
    license: value.license ?? null,
    mediaConfidence: value.mediaConfidence ?? value._mediaConfidence,
    needsReview: value.needsReview ?? value._needsReview
  }
}

export function buildWorkshopDisplay(
  input: unknown,
  catalog: ReadonlyMap<string, WorkshopModelEntry>
): WorkshopDisplayEntry[] {
  if (Array.isArray(input)) {
    const entries = workshopDisplayEntriesSchema.parse(input)
    for (const entry of entries)
      if (!catalog.has(entry.modelId))
        throw new Error(
          `Display overlay names model absent from catalog: ${entry.modelId}`
        )
    return finalizeWorkshopDisplay(entries)
  }
  if (!isRecord(input)) {
    throw new Error(
      'Display overlay must be content records or a legacy model map'
    )
  }

  const overlay = Object.entries(input).map(([modelId, value]) => {
    const catalogModel = catalog.get(modelId)
    if (!catalogModel) {
      throw new Error(
        `Display overlay names model absent from catalog: ${modelId}`
      )
    }
    const parsed = workshopDisplaySourceSchema.safeParse(
      project(modelId, value, catalogModel)
    )
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(
        `Invalid display entry for ${modelId}: ${issue.path.join('.')} ${issue.message}`
      )
    }
    return parsed.data
  })

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
  return finalizeWorkshopDisplay(splitWorkshopDisplay(overlay))
}

function finalizeWorkshopDisplay(
  entries: WorkshopDisplayEntry[]
): WorkshopDisplayEntry[] {
  return workshopDisplayEntriesSchema
    .parse(repairWorkshopExamples(entries))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

async function catalogModels(): Promise<Map<string, WorkshopModelEntry>> {
  const raw = JSON.parse(await readFile(CATALOG, 'utf8')) as unknown
  if (!Array.isArray(raw)) throw new Error('Catalog is not an array')
  const models = raw.map((model, index) => {
    const parsed = workshopModelSchema.safeParse(model)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new Error(
        `Invalid catalog entry at index ${index}: ${issue.path.join('.')} ${issue.message}`
      )
    }
    return parsed.data
  })
  return new Map(models.map((model) => [model.id, model]))
}

async function main(): Promise<void> {
  const dropPath = process.argv[2]
  if (!dropPath) {
    throw new Error(
      'Usage: pnpm generate:workshop-display /path/to/workshop-display.json'
    )
  }

  const drop = JSON.parse(await readFile(resolve(dropPath), 'utf8')) as unknown
  const overlay = buildWorkshopDisplay(drop, await catalogModels())

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
