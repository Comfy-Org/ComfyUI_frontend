import catalogJson from '../content/workshop-models.json'
import displayJson from '../content/workshop-display.json'
import indexJson from '../content/workshop-router-index.json'
import aliasesJson from '../content/workshop-router-aliases.json'
import displayNames from '../data/workshop-router-display-names.json'
import { workshopDisplaySchema } from '../content/workshop-display.schema'
import { workshopModelSchema } from '../content/workshop-models.schema'
import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { Modality, UseCase, WorkshopModel } from './models-catalogue'
import { workshopRouterIndexSchema } from './workshop-router-index'
import { workshopRouterAliasesSchema } from './workshop-router-identity'
import { labelSharedThumbnails } from './workshop-thumbnail-labels'

const routerIndex = workshopRouterIndexSchema.parse(indexJson)
const canonicalNames = new Map(Object.entries(displayNames))
for (const id of canonicalNames.keys())
  if (!routerIndex.some((entry) => entry.id === id))
    throw new Error(`Display name has no Router model: ${id}`)
export const routerAliasById = new Map(
  workshopRouterAliasesSchema
    .parse(aliasesJson)
    .map((alias) => [alias.id, alias])
)

function modalityFor(model: WorkshopModelEntry): Modality {
  if (model.modality === 'music') return 'audio'
  if (model.modality === 'svg') return 'image'
  return model.modality
}

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  bfl: 'Black Forest Labs',
  byteplus: 'ByteDance',
  'byteplus-mediakit': 'ByteDance',
  elevenlabs: 'ElevenLabs',
  fishaudio: 'Fish Audio',
  gemini: 'Google',
  ltx: 'Lightricks',
  luma_2: 'Luma',
  openai: 'OpenAI',
  synclabs: 'Sync Labs',
  'tencent-hunyuan3d': 'Tencent',
  vertexai: 'Google',
  wavespeed: 'WaveSpeed',
  xai: 'xAI'
}

function providerName(provider: string): string {
  return (
    PROVIDER_NAMES[provider] ??
    provider
      .split('-')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ')
  )
}

// Router does not expose usage counts yet. Keep Mar's prototype treatment:
// a stable, clearly synthetic ordering value rather than showing every model
// as having zero runs in the popular-model picker.
function placeholderRuns(slug: string, workflowCount: number): number {
  let seed = 7
  for (let index = 0; index < slug.length; index += 1) {
    seed = (seed * 31 + slug.charCodeAt(index)) % 1_000_003
  }
  return (workflowCount + 1) * (4000 + (seed % 37) * 1000)
}

function taskForUseCases(useCases: readonly UseCase[]): WorkshopModel['task'] {
  if (useCases.includes('edit-images')) return 'image-to-image'
  if (useCases.includes('animate-images')) return 'image-to-video'
  if (useCases.includes('edit-videos')) return 'video-to-video'
  if (useCases.includes('generate-images')) return 'text-to-image'
  if (useCases.includes('generate-videos')) return 'text-to-video'
  if (useCases.includes('audio')) return 'text-to-audio'
  if (useCases.includes('3d')) return 'text-to-3d'
  return 'text-to-text'
}

const legacyCatalog = (catalogJson as unknown[]).map((entry) =>
  workshopModelSchema.parse(entry)
)
const display = (displayJson as unknown[]).map((entry) =>
  workshopDisplaySchema.parse(entry)
)
const displayById = new Map(display.map((entry) => [entry.id, entry]))

const catalogById = new Map(legacyCatalog.map((entry) => [entry.id, entry]))
const contentSources = [...routerAliasById.values()].map((alias) => {
  const entry = catalogById.get(alias.id)
  const overlay = displayById.get(alias.id)
  if (
    !entry ||
    !overlay ||
    !routerIndex.some((record) => record.id === alias.routerId)
  )
    throw new Error(`Invalid Router content join: ${alias.id}`)
  return { alias, entry, overlay }
})
export const routerContentById = new Map(
  routerIndex.flatMap((record) => {
    const sources = contentSources.filter(
      ({ alias }) => alias.routerId === record.id
    )
    return sources.length ? [[record.id, sources] as const] : []
  })
)

const browseModels: readonly WorkshopModel[] = routerIndex
  .filter((record) => routerContentById.has(record.id))
  .map((record) => {
    const sources = routerContentById.get(record.id)
    if (!sources?.length)
      throw new Error(`Missing Router content: ${record.id}`)
    const primary =
      sources.find(({ alias }) => alias.displayPrimary) ??
      sources.find(({ entry }) => entry.id === record.id) ??
      (sources.length === 1 ? sources[0] : undefined)
    if (!primary) throw new Error(`Choose primary Router content: ${record.id}`)
    const { entry, overlay, alias } = primary
    const reviewed = sources.filter(({ alias }) => !alias.contentIssue)
    const useCases = [
      ...new Set(sources.flatMap(({ overlay }) => overlay.useCases))
    ]
    const modalities = [
      ...new Set(sources.map(({ entry }) => modalityFor(entry)))
    ]
    const exampleCount = Math.min(
      6,
      reviewed.reduce(
        (count, { overlay }) => count + (overlay.media.samples?.length ?? 0),
        0
      )
    )
    const thumbnail = alias.contentIssue ? undefined : overlay.media.thumbnail
    const slug = record.id.replace('/', '--')
    return {
      slug,
      name:
        overlay.displayName ??
        canonicalNames.get(record.id) ??
        (sources.length === 1 || entry.id === record.id
          ? entry.displayName
          : record.id.split('/')[1]),
      workflowCount: exampleCount,
      href: `/models/${slug}/`,
      routerId: record.id,
      incompleteReason: record.incompleteReason,
      provider: providerName(entry.provider),
      modality: modalityFor(entry),
      modalities,
      task: taskForUseCases(useCases),
      useCases,
      capabilities: [...new Set(sources.flatMap(({ entry }) => entry.tags))],
      runs: placeholderRuns(slug, exampleCount),
      ...(overlay.pricing && entry.id === record.id
        ? { creditsPerRun: overlay.pricing.creditsPerRun }
        : {}),
      ...(thumbnail
        ? {
            thumbnailUrl: thumbnail.url,
            thumbnail: { url: thumbnail.url, kind: thumbnail.kind }
          }
        : {}),
      ...(sources.length === 1 && entry.description
        ? { summary: entry.description }
        : {}),
      ...(sources.every(({ overlay }) => overlay.status === 'deprecated')
        ? { status: 'deprecated' as const }
        : {})
    }
  })

export const routerWorkshopModels = labelSharedThumbnails(browseModels)

export const routerModelSlugAliases = new Map(
  [...routerAliasById.values()].map((alias) => [
    alias.id.replace('/', '--'),
    alias.routerId.replace('/', '--')
  ])
)
export const routerWorkshopModelPaths = [
  ...new Set([
    ...routerWorkshopModels.map((model) => model.slug),
    ...routerModelSlugAliases.keys()
  ])
]
