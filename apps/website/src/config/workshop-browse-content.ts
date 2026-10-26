import catalogJson from '@/content/workshop-models.json'
import displayJson from '@/content/workshop-display.json'
import indexJson from '@/content/workshop-router-index.json'
import aliasesJson from '@/content/workshop-router-aliases.json'
import displayNames from '@/data/workshop-router-display-names.json'
import useCaseOverrides from '@/data/workshop-use-case-overrides.json'
import summaryOverrides from '@/data/workshop-model-summaries.json'
import { workshopDisplayEntriesSchema } from '@/content/workshop-display.schema'
import { workshopModelSchema } from '@/content/workshop-models.schema'
import type { WorkshopModelEntry } from '@/content/workshop-models.schema'
import type { WorkshopDisplayEntry } from '@/content/workshop-display.schema'
import type { Modality, UseCase, RouterWorkshopModel } from './models-catalogue'
import { USE_CASES } from './models-catalogue'
import { workshopRouterIndexSchema } from './workshop-router-index'
import { workshopRouterAliasesSchema } from './workshop-router-identity'
import { labelSharedThumbnails } from './workshop-thumbnail-labels'
import { workshopContentInputs } from './workshop-content-inputs'
import { modelSummary } from '@/lib/workshop/model-summary'
import { providerName } from '@/lib/workshop/provider-name'
import { modelOrderRank } from './workshop-model-order'
import { hubModelHref } from './hub-models'
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

export const workshopDisplayEntries =
  workshopDisplayEntriesSchema.parse(displayJson)
const displaySlugs = new Set(workshopDisplayEntries.map((entry) => entry.slug))
const modelPageSlugs = new Set(
  workshopDisplayEntries
    .filter((entry) => entry.type === undefined || entry.type === 'MODEL')
    .map((entry) => entry.slug)
)

export function editorialSummariesFor(
  overrides: Readonly<Record<string, string>>,
  pageSlugs: ReadonlySet<string>
): ReadonlyMap<string, string> {
  const summaries = new Map(
    Object.entries(overrides).map(([slug, summary]) => [slug, summary.trim()])
  )
  for (const [slug, summary] of summaries)
    if (!pageSlugs.has(slug) || !summary)
      throw new Error(`Invalid model summary for page: ${slug}`)
  return summaries
}

const editorialSummaries = editorialSummariesFor(
  summaryOverrides,
  modelPageSlugs
)
for (const slug of modelOrderRank.keys())
  if (!displaySlugs.has(slug))
    throw new Error(`Recommended model order names an unknown page: ${slug}`)

const catalogById = new Map(legacyCatalog.map((entry) => [entry.id, entry]))
for (const slug of workshopModelAvailability.keys())
  if (!workshopDisplayEntries.some((overlay) => overlay.slug === slug))
    throw new Error(`Model availability names an unknown page: ${slug}`)

function bindingFor(overlay: (typeof workshopDisplayEntries)[number]) {
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

const contentSources = workshopDisplayEntries
  .filter((overlay) => overlay.type === undefined || overlay.type === 'MODEL')
  .flatMap((overlay) => {
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

export function unpublishedSummaryWarning(
  summarySlugs: Iterable<string>,
  publishedSlugs: Pick<ReadonlySet<string>, 'has'>
): string | undefined {
  const unpublished = [...summarySlugs].filter(
    (slug) => !publishedSlugs.has(slug)
  )
  if (!unpublished.length) return undefined
  return `Model summaries kept for pages this build does not publish: ${unpublished.join(', ')}`
}

const summaryWarning = unpublishedSummaryWarning(
  editorialSummaries.keys(),
  routerContentBySlug
)
if (summaryWarning) console.warn(summaryWarning)
export const routerContentById = new Map(
  routerIndex.flatMap((record) => {
    const sources = publishedContentSources.filter(
      ({ binding }) => binding.routerId === record.id
    )
    return sources.length ? [[record.id, sources] as const] : []
  })
)

export function correctedUseCase(
  overrides: ReadonlyMap<string, UseCase>,
  ids: { entryId: string; routerId: string },
  authored: UseCase
): UseCase {
  return overrides.get(ids.entryId) ?? overrides.get(ids.routerId) ?? authored
}

export function publishableMedia(
  media: WorkshopDisplayEntry['media'],
  hasContentIssue: boolean
) {
  if (hasContentIssue) return { exampleCount: 0, thumbnail: undefined }
  return {
    exampleCount: Math.min(6, media.samples?.length ?? 0),
    thumbnail: media.thumbnail
  }
}

export function modelDisplayName(names: {
  authored?: string
  canonical?: string
  entry: string
  modelsSharingRouterUseCase?: number
}): string {
  const disambiguated =
    (names.modelsSharingRouterUseCase ?? 0) > 1 ? names.entry : undefined
  return names.authored ?? disambiguated ?? names.canonical ?? names.entry
}

export function modelSummaryFor(
  editorial: string | undefined,
  description: string,
  model: { name: string; provider: string }
): string | undefined {
  if (editorial !== undefined) return editorial
  return description
    ? modelSummary(description, model.name, model.provider)
    : undefined
}

const browseModels: readonly RouterWorkshopModel[] = contentSources.map(
  ({ entry, overlay, binding, record }) => {
    const useCases = [
      correctedUseCase(
        correctedUseCases,
        { entryId: entry.id, routerId: record.id },
        overlay.useCase
      )
    ]
    const { exampleCount, thumbnail } = publishableMedia(
      overlay.media,
      binding.contentIssue !== undefined
    )
    const slug = overlay.slug
    const recommendedRank = modelOrderRank.get(slug)
    const name = modelDisplayName({
      authored: overlay.displayName,
      canonical: canonicalNames.get(record.id),
      entry: entry.displayName,
      modelsSharingRouterUseCase: sharedNames.get(
        `${record.id}:${overlay.useCase}`
      )?.size
    })
    const provider = providerName(entry.provider)
    const summary = modelSummaryFor(
      editorialSummaries.get(slug),
      entry.description,
      { name, provider }
    )
    return {
      slug,
      name,
      workflowCount: exampleCount,
      ...(recommendedRank !== undefined ? { recommendedRank } : {}),
      ...(isWorkshopModelDisabled(slug) ? {} : { href: hubModelHref(slug) }),
      routerId: record.id,
      ...(record.altProviders ? { servedBy: record.altProviders } : {}),
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
            thumbnail: {
              url: thumbnail.url,
              kind: thumbnail.kind,
              ...(thumbnail.poster ? { poster: thumbnail.poster } : {})
            }
          }
        : {}),
      ...(summary ? { summary } : {}),
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
