import type { WorkshopModelEntry } from '../content/workshop-models.schema'

export const WORKSHOP_OUTPUTS = ['image', 'video', 'audio', '3d'] as const
export const WORKSHOP_INITIAL_MODEL_LIMIT = 48

type WorkshopOutput = (typeof WORKSHOP_OUTPUTS)[number]
export type WorkshopOutputFilter = WorkshopOutput | 'all'

export interface WorkshopBrowseModel {
  readonly id: string
  readonly slug: string
  readonly href: string
  readonly name: string
  readonly provider: string
  readonly output: WorkshopOutput
  readonly description: string
  readonly tags: readonly string[]
}

function outputFor(modality: WorkshopModelEntry['modality']): WorkshopOutput {
  if (modality === 'music') return 'audio'
  if (modality === 'svg') return 'image'
  return modality
}

/**
 * The card-sized view of a model. Deliberately a projection rather than the
 * whole entry: `parameters` is the largest field on a model and the browse
 * page has no use for it, so it never reaches the browser.
 */
export function toBrowseModel(entry: WorkshopModelEntry): WorkshopBrowseModel {
  return {
    id: entry.id,
    slug: entry.slug,
    href: `/workshop/models/${entry.slug}/`,
    name: entry.displayName,
    provider: entry.provider,
    output: outputFor(entry.modality),
    description: entry.description,
    tags: entry.tags
  }
}

export interface WorkshopFilter {
  readonly query?: string
  readonly output?: WorkshopOutputFilter
  readonly provider?: string
}

function searchTerms(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function filterWorkshopModels(
  models: readonly WorkshopBrowseModel[],
  { query = '', output = 'all', provider = 'all' }: WorkshopFilter
): WorkshopBrowseModel[] {
  const needle = searchTerms(query)
  return models.filter(
    (model) =>
      (output === 'all' || model.output === output) &&
      (provider === 'all' || model.provider === provider) &&
      (needle === '' ||
        searchTerms(
          [model.name, model.provider, model.description, ...model.tags].join(
            ' '
          )
        ).includes(needle))
  )
}

export function countWorkshopOutputs(
  models: readonly WorkshopBrowseModel[]
): Record<WorkshopOutputFilter, number> {
  const counts: Record<WorkshopOutputFilter, number> = {
    all: models.length,
    image: 0,
    video: 0,
    audio: 0,
    '3d': 0
  }
  for (const model of models) counts[model.output] += 1
  return counts
}
