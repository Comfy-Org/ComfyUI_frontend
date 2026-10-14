/** Usage numbers an agent copies onto each item from analytics; staff only read them. */
export interface ItemStats {
  popularity?: number
  downloads?: number
  runs?: number
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined

export function itemStats(data: Record<string, unknown>): ItemStats {
  return {
    popularity: count(data.popularity),
    downloads: count(data.downloads),
    runs: count(data.runs)
  }
}

export type SortKey = 'name' | keyof ItemStats
export interface SortOrder {
  key: SortKey
  descending: boolean
}

/**
 * Sorts by a column. Rows missing that number always go last, and ties keep
 * their catalog order, so the list doesn't jump around between sorts.
 */
export function sortRows<T extends { title: string; stats: ItemStats }>(
  rows: T[],
  { key, descending }: SortOrder
): T[] {
  const direction = descending ? -1 : 1
  const compare = (a: T, b: T) => {
    if (key === 'name') return a.title.localeCompare(b.title) * direction
    const left = a.stats[key]
    const right = b.stats[key]
    if (left === undefined || right === undefined)
      return Number(left === undefined) - Number(right === undefined)
    return (left - right) * direction
  }
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compare(a.row, b.row) || a.index - b.index)
    .map(({ row }) => row)
}

export function compactCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}
