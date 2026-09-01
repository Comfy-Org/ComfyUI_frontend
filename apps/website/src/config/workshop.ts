import type { Model } from './models'
import { models } from './models'
import displayOverrides from './workshop-model-display.json'

const MODALITIES = ['image', 'video', 'audio', '3d', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

export const MODALITY_FILTERS = ['all', ...MODALITIES, 'other'] as const
export type ModalityFilter = (typeof MODALITY_FILTERS)[number]

// Router only serves model id + billing today. Name, provider, modality and
// price come from this hand-maintained file until Router exposes display
// metadata (Detailed Requirements M1/M2). Values are placeholders.
export type ModelStatus = 'deprecated' | 'degraded'

interface WorkshopModelDisplay {
  readonly provider?: string
  readonly modality?: Modality
  readonly creditsPerRun?: number
  readonly status?: ModelStatus
  readonly successorSlug?: string
}

export interface WorkshopModel {
  readonly slug: string
  readonly name: string
  readonly workflowCount: number
  readonly href: string
  readonly routerId: string
  readonly provider?: string
  readonly modality?: Modality
  readonly creditsPerRun?: number
  readonly status?: ModelStatus
  readonly successorSlug?: string
}

const display = displayOverrides as Record<string, WorkshopModelDisplay>

function modelDetailHref(slug: string): string {
  return `/workshop/models/${slug}/`
}

// Router ids are `{provider}/{model}`; the registry only knows the slug, so
// the provider half is derived from display metadata until Router serves it.
function routerIdFor(slug: string, provider?: string): string {
  const providerSlug = (provider ?? 'comfy')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${providerSlug}/${slug}`
}

function toWorkshopModel(model: Model): WorkshopModel {
  const overrides = display[model.slug]
  return {
    slug: model.slug,
    name: model.displayName,
    workflowCount: model.workflowCount,
    href: modelDetailHref(model.slug),
    routerId: routerIdFor(model.slug, overrides?.provider),
    ...overrides
  }
}

export function isRouterModel(model: Model): boolean {
  return (
    model.directory === 'partner_nodes' && model.canonicalSlug === undefined
  )
}

export const workshopModels: readonly WorkshopModel[] = models
  .filter(isRouterModel)
  .map(toWorkshopModel)

export function getWorkshopModel(slug: string): WorkshopModel | undefined {
  return workshopModels.find((model) => model.slug === slug)
}

export function modalityOf(
  model: WorkshopModel
): Exclude<ModalityFilter, 'all'> {
  return model.modality ?? 'other'
}

export interface WorkshopFilter {
  readonly query: string
  readonly modality: ModalityFilter
}

export function filterWorkshopModels(
  list: readonly WorkshopModel[],
  { query, modality }: WorkshopFilter
): WorkshopModel[] {
  const needle = query.trim().toLowerCase()
  return list.filter(
    (model) =>
      (modality === 'all' || modalityOf(model) === modality) &&
      (needle === '' ||
        model.name.toLowerCase().includes(needle) ||
        (model.provider?.toLowerCase().includes(needle) ?? false))
  )
}

export function countByModality(
  list: readonly WorkshopModel[]
): Record<ModalityFilter, number> {
  const counts = Object.fromEntries(
    MODALITY_FILTERS.map((filter) => [filter, 0])
  ) as Record<ModalityFilter, number>
  for (const model of list) {
    counts.all += 1
    counts[modalityOf(model)] += 1
  }
  return counts
}
