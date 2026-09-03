import snapshot from './workshop-catalog.generated.json'

export const WORKSHOP_OUTPUTS = ['image', 'video', 'audio', '3d'] as const

type WorkshopOutput = (typeof WORKSHOP_OUTPUTS)[number]
export type WorkshopOutputFilter = WorkshopOutput | 'all'

interface CatalogModel {
  readonly id: string
  readonly slug: string
  readonly displayName: string
  readonly provider: string
  readonly modality: WorkshopOutput | 'music' | 'svg'
  readonly description: string
  readonly tags: readonly string[]
}

interface CatalogSnapshot {
  readonly sourceRef: string
  readonly models: readonly CatalogModel[]
}

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

function outputFor(modality: CatalogModel['modality']): WorkshopOutput {
  if (modality === 'music') return 'audio'
  if (modality === 'svg') return 'image'
  return modality
}

const catalog = snapshot as CatalogSnapshot

export const workshopModels: readonly WorkshopBrowseModel[] =
  catalog.models.map((model) => ({
    id: model.id,
    slug: model.slug,
    href: `/workshop/models/${model.slug}/`,
    name: model.displayName,
    provider: model.provider,
    output: outputFor(model.modality),
    description: model.description,
    tags: model.tags
  }))

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
