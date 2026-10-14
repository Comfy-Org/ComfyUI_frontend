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

/** Most popular first; items without a score keep their order after the rest. */
export function byPopularity<T extends { stats: ItemStats }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        (b.row.stats.popularity ?? -1) - (a.row.stats.popularity ?? -1) ||
        a.index - b.index
    )
    .map(({ row }) => row)
}

export function compactCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}
