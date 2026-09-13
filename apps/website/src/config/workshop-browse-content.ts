import catalogJson from '../content/workshop-models.json'
import displayJson from '../content/workshop-display.json'
import indexJson from '../content/workshop-router-index.json'
import aliasesJson from '../content/workshop-router-aliases.json'
import displayNames from '../data/workshop-router-display-names.json'
import { workshopDisplayEntriesSchema } from '../content/workshop-display.schema'
import { workshopModelSchema } from '../content/workshop-models.schema'
import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { Modality, UseCase, WorkshopModel } from './models-catalogue'
import { workshopRouterIndexSchema } from './workshop-router-index'
import { workshopRouterAliasesSchema } from './workshop-router-identity'
import { labelSharedThumbnails } from './workshop-thumbnail-labels'
import { workshopContentInputs } from './workshop-content-inputs'
import {
  isWorkshopModelDisabled,
  workshopModelAvailability
} from './workshop-model-availability'

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
const display = workshopDisplayEntriesSchema.parse(displayJson)

const catalogById = new Map(legacyCatalog.map((entry) => [entry.id, entry]))
for (const slug of workshopModelAvailability.keys())
  if (!display.some((overlay) => overlay.slug === slug))
    throw new Error(`Model availability names an unknown page: ${slug}`)
const contentSources = display.flatMap((overlay) => {
  if (isWorkshopModelDisabled(overlay.slug)) return []
  const alias = routerAliasById.get(overlay.modelId)
  if (!alias) return []
  const entry = catalogById.get(overlay.modelId)
  const record = routerIndex.find((record) => record.id === alias.routerId)
  if (!entry || !record)
    throw new Error(`Invalid Router content join: ${overlay.id}`)
  if (record.incompleteReason || record.unavailableReason) return []
  const input = workshopContentInputs.get(overlay.id)
  if (input && input.routerId !== record.id)
    throw new Error(`Wrong Router model for content inputs: ${overlay.id}`)
  if (input?.unavailableReason) return []
  return [{ alias, entry, overlay, record }]
})
const sharedNames = new Map<string, Set<string>>()
for (const { overlay, record } of contentSources) {
  const key = `${record.id}:${overlay.useCase}`
  const names = sharedNames.get(key) ?? new Set<string>()
  names.add(overlay.modelId)
  sharedNames.set(key, names)
}
export const routerContentBySlug = new Map(
  contentSources.map((source) => [source.overlay.slug, source])
)
export const routerContentById = new Map(
  routerIndex.flatMap((record) => {
    const sources = contentSources.filter(
      ({ alias }) => alias.routerId === record.id
    )
    return sources.length ? [[record.id, sources] as const] : []
  })
)

const browseModels: readonly WorkshopModel[] = contentSources.map(
  ({ entry, overlay, alias, record }) => {
    const useCases = [overlay.useCase]
    const exampleCount = Math.min(
      6,
      alias.contentIssue ? 0 : (overlay.media.samples?.length ?? 0)
    )
    const thumbnail = alias.contentIssue ? undefined : overlay.media.thumbnail
    const slug = overlay.slug
    return {
      slug,
      name:
        overlay.displayName ??
        ((sharedNames.get(`${record.id}:${overlay.useCase}`)?.size ?? 0) > 1
          ? entry.displayName
          : undefined) ??
        canonicalNames.get(record.id) ??
        entry.displayName,
      workflowCount: exampleCount,
      href: `/models/${slug}/`,
      routerId: record.id,
      incompleteReason: record.incompleteReason,
      provider: providerName(entry.provider),
      modality: modalityFor(entry),
      modalities: [modalityFor(entry)],
      task: taskForUseCases(useCases),
      useCases,
      capabilities: entry.tags,
      ...(thumbnail
        ? {
            thumbnailUrl: thumbnail.url,
            thumbnail: { url: thumbnail.url, kind: thumbnail.kind }
          }
        : {}),
      ...(entry.description ? { summary: entry.description } : {}),
      ...(overlay.status === 'deprecated'
        ? { status: 'deprecated' as const }
        : {})
    }
  }
)

export const routerWorkshopModels = labelSharedThumbnails(browseModels)

function primarySlug(sources: typeof contentSources): string {
  const primary = sources.filter(({ alias }) => alias.displayPrimary)
  const candidates = primary.length ? primary : sources
  const withMedia = candidates.filter(({ overlay }) => overlay.media.thumbnail)
  const source = (withMedia.length ? withMedia : candidates).at(0)
  if (!source) throw new Error('Missing content redirect target')
  return source.overlay.slug
}

export const routerModelSlugAliases = new Map<string, string>()
for (const [routerId, sources] of routerContentById)
  routerModelSlugAliases.set(routerId.replace('/', '--'), primarySlug(sources))
for (const alias of routerAliasById.values()) {
  const sources = contentSources.filter(({ entry }) => entry.id === alias.id)
  if (sources.length)
    routerModelSlugAliases.set(
      alias.id.replace('/', '--'),
      primarySlug(sources)
    )
}
for (const slug of routerModelSlugAliases.keys())
  if (routerContentBySlug.has(slug))
    throw new Error(`Content slug collides with a legacy redirect: ${slug}`)
export const routerWorkshopModelPaths = [
  ...new Set([
    ...routerWorkshopModels.map((model) => model.slug),
    ...routerModelSlugAliases.keys()
  ])
]
