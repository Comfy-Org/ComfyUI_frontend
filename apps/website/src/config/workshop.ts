import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import type { WorkshopModelEntry } from '../content/workshop-models.schema'

export const WORKSHOP_OUTPUTS = ['image', 'video', 'audio', '3d'] as const
export const WORKSHOP_PAGE_SIZE = 48

type WorkshopOutput = (typeof WORKSHOP_OUTPUTS)[number]
export type WorkshopOutputFilter = WorkshopOutput | 'all'

/** Not exported: it is only ever reached through `WorkshopBrowseModel`. */
interface WorkshopBrowseThumbnail {
  readonly url: string
  /** Carried explicitly: CDN assets are often named by UUID, so the file
   *  extension is not reliably there to read. */
  readonly kind: 'image' | 'video' | 'audio'
}

export interface WorkshopBrowseModel {
  readonly id: string
  readonly href: string
  readonly name: string
  readonly provider: string
  readonly output: WorkshopOutput
  readonly description: string
  readonly tags: readonly string[]
  /** Absent for the 7 models the content pass has not reached yet. */
  readonly thumbnail?: WorkshopBrowseThumbnail
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
export function toBrowseModel(
  entry: WorkshopModelEntry,
  display?: WorkshopDisplayEntry
): WorkshopBrowseModel {
  const thumbnail = display?.media.thumbnail
  return {
    id: entry.id,
    href: `/workshop/models/${entry.slug}/`,
    name: entry.displayName,
    provider: entry.provider,
    output: outputFor(entry.modality),
    description: entry.description,
    tags: entry.tags,
    // Only the two fields a card needs. The overlay also carries prompts and
    // review flags, which have no business reaching the browser.
    ...(thumbnail && {
      thumbnail: { url: thumbnail.url, kind: thumbnail.kind }
    })
  }
}

/**
 * Projects and orders the Router snapshot for the catalog page at build time.
 */
export function prepareWorkshopBrowseModels(
  entries: readonly WorkshopModelEntry[],
  display: readonly WorkshopDisplayEntry[] = []
): WorkshopBrowseModel[] {
  const byModelId = new Map(display.map((entry) => [entry.id, entry]))
  return entries
    .map((entry) => toBrowseModel(entry, byModelId.get(entry.id)))
    .sort((left, right) => left.id.localeCompare(right.id))
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
