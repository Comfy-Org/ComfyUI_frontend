import type { CardView } from './catalogue-card'
import type { EntryKind } from './catalogue-entries'

/**
 * The two halves of the catalogue. They are not the same kind of thing: a
 * model is a capability and a workflow is a job, so they carry different
 * measures, different orders and different rows, and a list holding both
 * compares what does not compare. An app is a workflow somebody wrapped in a
 * form, so it answers to that tab rather than asking for one of its own.
 */
export type TypeFilter = 'model' | 'workflow'

/**
 * One card, projected for the browser. The catalogue itself never crosses the
 * boundary: the page resolves it and hands over only what the grid draws and
 * the search, the order and the crossings read, which is why this module
 * imports no data.
 */
export interface BrowseEntry {
  readonly key: string
  readonly kind: EntryKind
  readonly title: string
  /**
   * The shelves it stands on. The two halves shelve by different axes: a model
   * by the use cases it serves, a workflow by the one launch category the spec
   * files it under, so the key is a string rather than either axis's own type.
   */
  readonly shelves: readonly string[]
  /** The models it names, for search and for "the workflows that use this". */
  readonly models: readonly string[]
  /** What it is good for, in the reader's words. Read by search only. */
  readonly tags: readonly string[]
  /** Its kind's own measure: a rank for models, installs for the rest. */
  readonly standing: number
  readonly date: string | undefined
  readonly card: CardView
}

export type CatalogueOrder = 'popular' | 'name' | 'newest'

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
      (b.date ?? '').localeCompare(a.date ?? '') || byTitle(a, b)
  }
  return [...entries].sort(compare[order])
}

/** What the catalogue opens on, read off a link rather than off the browser. */
export interface BrowseRequest {
  readonly type: TypeFilter
  /** Unvalidated: which keys are shelves depends on the tab it arrives with. */
  readonly shelf: string
  readonly usesModel: string
  readonly query: string
  /** Whether the address asked past the shelves, for the half entire. */
  readonly all: boolean
}

const TABS: readonly TypeFilter[] = ['model', 'workflow']

export function browseRequestFrom(search: string): BrowseRequest {
  const params = new URLSearchParams(search)
  const asked = params.get('type')
  const model = params.get('model') ?? ''
  return {
    // "N workflows use this" lands on that model's uses, so the link implies
    // the tab even when it does not name one.
    type: model ? 'workflow' : (TABS.find((tab) => tab === asked) ?? 'model'),
    shelf: params.get('useCase') ?? 'all',
    usesModel: model,
    query: params.get('q') ?? '',
    all: params.get('all') === '1'
  }
}
