import catalogJson from '../content/workshop-models.json'
import displayJson from '../content/workshop-display.json'
import indexJson from '../content/workshop-router-index.json'
import aliasesJson from '../content/workshop-router-aliases.json'
import displayNames from '../data/workshop-router-display-names.json'
import useCaseOverrides from '../data/workshop-use-case-overrides.json'
import { workshopDisplayEntriesSchema } from '../content/workshop-display.schema'
import { workshopModelSchema } from '../content/workshop-models.schema'
import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { Modality, UseCase, RouterWorkshopModel } from './models-catalogue'
import { USE_CASES } from './models-catalogue'
import { workshopRouterIndexSchema } from './workshop-router-index'
import { workshopRouterAliasesSchema } from './workshop-router-identity'
import { labelSharedThumbnails } from './workshop-thumbnail-labels'
import { workshopContentInputs } from './workshop-content-inputs'
import { modelSummary } from '../lib/workshop/model-summary'
import { modelOrderRank } from './workshop-model-order'
import {
  isWorkshopModelDisabled,
  workshopModelAvailability
} from './workshop-model-availability'

const routerIndex = workshopRouterIndexSchema.parse(indexJson)
const legacyCatalog = (catalogJson as unknown[]).map((entry) =>
  workshopModelSchema.parse(entry)
)
const correctedUseCases = new Map(
  Object.entries(useCaseOverrides).map(([id, value]): [string, UseCase] => {
    const useCase = USE_CASES.find((item) => item === value)
    if (
      !useCase ||
      (!routerIndex.some((model) => model.id === id) &&
        !legacyCatalog.some((model) => model.id === id))
    )
      throw new Error(`Invalid Router use-case override: ${id}`)
    return [id, useCase]
  })
)
const canonicalNames = new Map(Object.entries(displayNames))
for (const id of canonicalNames.keys())
  if (!routerIndex.some((entry) => entry.id === id))
    throw new Error(`Display name has no Router model: ${id}`)
const routerAliases = workshopRouterAliasesSchema.parse(aliasesJson)
export const routerAliasById = new Map(
  routerAliases.map((alias) => [alias.id, alias])
)
const identitySourceCommits = new Set(
  routerAliases.map((alias) => alias.sourceCommit)
)
if (identitySourceCommits.size !== 1)
  throw new Error('Router aliases must use one source commit')
const identitySourceCommit = [...identitySourceCommits][0]
if (!identitySourceCommit) throw new Error('Missing Router identity source')

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

function taskForUseCases(
  useCases: readonly UseCase[]
): RouterWorkshopModel['task'] {
  if (useCases.includes('edit-images')) return 'image-to-image'
  if (useCases.includes('animate-images')) return 'image-to-video'
  if (useCases.includes('edit-videos')) return 'video-to-video'
  if (useCases.includes('generate-images')) return 'text-to-image'
  if (useCases.includes('generate-videos')) return 'text-to-video'
  if (useCases.includes('audio')) return 'text-to-audio'
  if (useCases.includes('3d')) return 'text-to-3d'
  return 'text-to-text'
}

const display = workshopDisplayEntriesSchema.parse(displayJson)
const displaySlugs = new Set(display.map((entry) => entry.slug))
for (const slug of modelOrderRank.keys())
  if (!displaySlugs.has(slug))
    throw new Error(`Recommended model order names an unknown page: ${slug}`)

const catalogById = new Map(legacyCatalog.map((entry) => [entry.id, entry]))
for (const slug of workshopModelAvailability.keys())
  if (!display.some((overlay) => overlay.slug === slug))
    throw new Error(`Model availability names an unknown page: ${slug}`)

function bindingFor(overlay: (typeof display)[number]) {
  const input = workshopContentInputs.get(overlay.id)
  const alias = routerAliasById.get(overlay.modelId)
  if (!input) return alias
  return {
    ...(alias?.routerId === input.routerId ? alias : {}),
    id: overlay.modelId,
    routerId: input.routerId,
    sourceCommit: identitySourceCommit
  }
}

const contentSources = display.flatMap((overlay) => {
  if (overlay.type !== undefined && overlay.type !== 'MODEL') return []
  const input = workshopContentInputs.get(overlay.id)
  if (input?.unavailableReason) return []
  const binding = bindingFor(overlay)
  if (!binding) return []
  const entry = catalogById.get(overlay.modelId)
  const record = routerIndex.find((record) => record.id === binding.routerId)
  if (!entry || !record)
    throw new Error(`Invalid Router content join: ${overlay.id}`)
  if (record.incompleteReason || record.unavailableReason) return []
  return [{ binding, entry, overlay, record }]
})
const publishedContentSources = contentSources.filter(
  ({ overlay }) => !isWorkshopModelDisabled(overlay.slug)
)
type WorkshopContentSource = (typeof contentSources)[number]
const sharedNames = new Map<string, Set<string>>()
for (const { overlay, record } of contentSources) {
  const key = `${record.id}:${overlay.useCase}`
  const names = sharedNames.get(key) ?? new Set<string>()
  names.add(overlay.modelId)
  sharedNames.set(key, names)
}

export const authoredRouterContentBySlug = new Map(
  contentSources.map((source) => [source.overlay.slug, source])
)
export const routerContentBySlug = new Map(
  publishedContentSources.map((source) => [source.overlay.slug, source])
)
export const routerContentById = new Map(
  routerIndex.flatMap((record) => {
    const sources = publishedContentSources.filter(
      ({ binding }) => binding.routerId === record.id
    )
    return sources.length ? [[record.id, sources] as const] : []
  })
)

const browseModels: readonly RouterWorkshopModel[] = contentSources.map(
  ({ entry, overlay, binding, record }) => {
    const useCases = [
      correctedUseCases.get(entry.id) ??
        correctedUseCases.get(record.id) ??
        overlay.useCase
    ]
    const exampleCount = Math.min(
      6,
      binding.contentIssue ? 0 : (overlay.media.samples?.length ?? 0)
    )
    const thumbnail = binding.contentIssue ? undefined : overlay.media.thumbnail
    const slug = overlay.slug
    const recommendedRank = modelOrderRank.get(slug)
    const name =
      overlay.displayName ??
      ((sharedNames.get(`${record.id}:${overlay.useCase}`)?.size ?? 0) > 1
        ? entry.displayName
        : undefined) ??
      canonicalNames.get(record.id) ??
      entry.displayName
    const provider = providerName(entry.provider)
    return {
      slug,
      name,
      workflowCount: exampleCount,
      ...(recommendedRank !== undefined ? { recommendedRank } : {}),
      href: `/models/${slug}/`,
      routerId: record.id,
      incompleteReason: record.incompleteReason,
      provider,
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
      ...(entry.description
        ? { summary: modelSummary(entry.description, name, provider) }
        : {}),
      ...(overlay.status === 'deprecated'
        ? { status: 'deprecated' as const }
        : {})
    }
  }
)

export const authoredWorkshopModels = labelSharedThumbnails(browseModels)
export const workshopModels = labelSharedThumbnails(
  browseModels.filter((model) => !isWorkshopModelDisabled(model.slug))
)

function primarySlug(sources: readonly WorkshopContentSource[]): string {
  const primary = sources.filter(({ binding }) => binding.displayPrimary)
  const candidates = primary.length ? primary : sources
  const withExamples = candidates.filter(({ overlay }) =>
    Boolean(overlay.examples.length)
  )
  const withMedia = candidates.filter(({ overlay }) => overlay.media.thumbnail)
  const preferred = withExamples.length ? withExamples : withMedia
  const useCasePriority: readonly UseCase[] = [
    'generate-images',
    'generate-videos',
    'audio',
    '3d',
    'text',
    'animate-images',
    'edit-images',
    'edit-videos'
  ]
  const source = [...(preferred.length ? preferred : candidates)]
    .sort(
      (a, b) =>
        useCasePriority.indexOf(a.overlay.useCase) -
        useCasePriority.indexOf(b.overlay.useCase)
    )
    .at(0)
  if (!source) throw new Error('Missing content redirect target')
  return source.overlay.slug
}

export function assertNoModelSlugAliasCollisions(
  aliases: ReadonlyMap<string, string>,
  canonicalSlugs: ReadonlySet<string>
) {
  for (const slug of aliases.keys())
    if (canonicalSlugs.has(slug))
      throw new Error(`Content slug collides with a legacy redirect: ${slug}`)
}

function modelSlugAliasesFor(sources: readonly WorkshopContentSource[]) {
  const aliases = new Map<string, string>()
  for (const record of routerIndex) {
    const matches = sources.filter(
      ({ binding }) => binding.routerId === record.id
    )
    if (matches.length)
      aliases.set(record.id.replace('/', '--'), primarySlug(matches))
  }
  const sourcesByLegacyId = new Map<string, WorkshopContentSource[]>()
  for (const source of sources) {
    const matches = sourcesByLegacyId.get(source.entry.id) ?? []
    sourcesByLegacyId.set(source.entry.id, [...matches, source])
  }
  for (const [legacyId, matches] of sourcesByLegacyId)
    aliases.set(legacyId.replace('/', '--'), primarySlug(matches))
  const canonicalSlugs = new Set(sources.map(({ overlay }) => overlay.slug))
  assertNoModelSlugAliasCollisions(aliases, canonicalSlugs)
  return aliases
}

export const authoredRouterModelSlugAliases =
  modelSlugAliasesFor(contentSources)
export const routerModelSlugAliases = modelSlugAliasesFor(
  publishedContentSources
)
export const routerWorkshopModelPaths = [
  ...new Set([
    ...workshopModels.map((model) => model.slug),
    ...routerModelSlugAliases.keys()
  ])
]

export function getWorkshopModel(
  slug: string
): RouterWorkshopModel | undefined {
  const canonical = routerModelSlugAliases.get(slug) ?? slug
  return workshopModels.find((model) => model.slug === canonical)
}
