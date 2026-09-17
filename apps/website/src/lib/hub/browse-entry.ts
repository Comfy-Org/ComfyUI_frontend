import type { UseCase } from '../../config/models-catalogue'
import { USE_CASES } from '../../config/models-catalogue'
import type { CardView } from './catalogue-card'
import type { EntryKind } from './catalogue-entries'

export type TypeFilter = 'all' | EntryKind
export type NeedsFilter = 'any' | 'runsHere' | 'comfyui' | 'customNodes'

/**
 * One card, projected for the browser. The catalogue itself never crosses the
 * boundary: the page resolves it and hands over only what the grid draws and
 * the facets read, which is why this module imports no data.
 */
export interface BrowseEntry {
  readonly key: string
  readonly kind: EntryKind
  readonly title: string
  readonly useCases: readonly UseCase[]
  readonly outputs: readonly string[]
  readonly provider: string | undefined
  /** Whether this site can run it, directly or through the model it names. */
  readonly runsHere: boolean
  readonly needsCustomNodes: boolean
  /** The models it names, for search and for "the workflows that use this". */
  readonly models: readonly string[]
  /** What it is good for, in the reader's words. Read by search only. */
  readonly tags: readonly string[]
  /** Its kind's own measure: a rank for models, installs for the rest. */
  readonly standing: number
  readonly date: string | undefined
  readonly credits: number | undefined
  readonly card: CardView
}

export type CatalogueOrder =
  | 'popular'
  | 'name'
  | 'newest'
  | 'priceAsc'
  | 'priceDesc'

const byTitle = (a: BrowseEntry, b: BrowseEntry) =>
  a.title.localeCompare(b.title)

/**
 * A model's standing is a recommendation rank and a workflow's is an install
 * count, and the two share no scale, so "popular" cannot interleave them
 * honestly. It reads capabilities first and then what is built on them, each
 * in the order its own kind understands.
 */
function byStanding(a: BrowseEntry, b: BrowseEntry): number {
  if (a.kind === 'model' && b.kind === 'model')
    return a.standing - b.standing || byTitle(a, b)
  if (a.kind === 'model') return -1
  if (b.kind === 'model') return 1
  return b.standing - a.standing || byTitle(a, b)
}

const credits = (entry: BrowseEntry, fallback: number) =>
  entry.credits ?? fallback

export function sortBrowseEntries(
  entries: readonly BrowseEntry[],
  order: CatalogueOrder
): BrowseEntry[] {
  const compare: Record<
    CatalogueOrder,
    (a: BrowseEntry, b: BrowseEntry) => number
  > = {
    popular: byStanding,
    name: byTitle,
    newest: (a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '') || byTitle(a, b),
    priceAsc: (a, b) =>
      credits(a, Number.POSITIVE_INFINITY) -
        credits(b, Number.POSITIVE_INFINITY) || byTitle(a, b),
    priceDesc: (a, b) => credits(b, -1) - credits(a, -1) || byTitle(a, b)
  }
  return [...entries].sort(compare[order])
}

/** What the catalogue opens on, read off a link rather than off the browser. */
export interface BrowseRequest {
  readonly type: TypeFilter
  readonly useCase: UseCase | 'all'
  readonly usesModel: string
  readonly query: string
}

const KINDS: readonly EntryKind[] = ['model', 'workflow', 'app']

export function browseRequestFrom(search: string): BrowseRequest {
  const params = new URLSearchParams(search)
  const asked = params.get('type')
  const model = params.get('model') ?? ''
  const useCase = USE_CASES.find((value) => value === params.get('useCase'))
  return {
    // "N workflows use this" lands on that model's uses, so the link implies
    // the type even when it does not name one.
    type: model ? 'workflow' : (KINDS.find((kind) => kind === asked) ?? 'all'),
    useCase: useCase ?? 'all',
    usesModel: model,
    query: params.get('q') ?? ''
  }
}
