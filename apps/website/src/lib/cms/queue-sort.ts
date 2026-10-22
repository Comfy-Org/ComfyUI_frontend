import type { QueueItem } from './queue'

export type QueueSort = 'NAME' | 'LATEST'

const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
})

function savedAt(item: QueueItem) {
  if (item.source !== 'catalog' || !item.savedAt) return undefined
  const time = Date.parse(item.savedAt)
  return Number.isNaN(time) ? undefined : time
}

/** Whether any item reports when it was saved, so latest-first can apply. */
export function canSortByLatest(items: readonly QueueItem[]) {
  return items.some((item) => savedAt(item) !== undefined)
}

// Name order is the default. Latest-first puts the most recent save on top;
// items without a save time follow in name order, and ties fall back to name.
export function sortQueue<T extends QueueItem>(
  items: readonly T[],
  sort: QueueSort
): T[] {
  const name = (a: T, b: T) =>
    byName.compare(a.title, b.title) || a.id.localeCompare(b.id)
  if (sort === 'NAME') return items.toSorted(name)
  return items.toSorted((a, b) => {
    const left = savedAt(a)
    const right = savedAt(b)
    if (left !== undefined && right !== undefined && left !== right)
      return right - left
    if (left === undefined && right !== undefined) return 1
    if (left !== undefined && right === undefined) return -1
    return name(a, b)
  })
}
