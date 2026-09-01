import type { Model } from './models'
import { models } from './models'
import displayOverrides from './workshop-model-display.json'

export const MODALITIES = ['image', 'video', 'audio', '3d', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

export const MODALITY_FILTERS = ['all', ...MODALITIES, 'other'] as const
export type ModalityFilter = (typeof MODALITY_FILTERS)[number]

// Router only serves model id + billing today. Name, provider, modality and
// price come from this hand-maintained file until Router exposes display
// metadata (Detailed Requirements M1/M2). Values are placeholders.
export interface WorkshopModelDisplay {
  readonly provider?: string
  readonly modality?: Modality
  readonly creditsPerRun?: number
}

export interface WorkshopModel {
  readonly slug: string
  readonly name: string
  readonly workflowCount: number
  readonly href: string
  readonly provider?: string
  readonly modality?: Modality
  readonly creditsPerRun?: number
}

const display = displayOverrides as Record<string, WorkshopModelDisplay>

export function modelDetailHref(slug: string): string {
  return `/p/supported-models/${slug}/`
}

export function toWorkshopModel(model: Model): WorkshopModel {
  return {
    slug: model.slug,
    name: model.displayName,
    workflowCount: model.workflowCount,
    href: modelDetailHref(model.slug),
    ...display[model.slug]
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
