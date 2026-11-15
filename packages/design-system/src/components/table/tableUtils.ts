import { deburr } from 'es-toolkit'

export type TableSortDirection = 'ascending' | 'descending'

const collator = new Intl.Collator(undefined, { numeric: true })

function normalizeSearchText(text: string) {
  return deburr(text).toLocaleLowerCase()
}

export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  getSearchFields: (item: T) => string[]
): T[] {
  const normalizedQuery = normalizeSearchText(query.trim())
  return items.filter((item) =>
    getSearchFields(item).some((field) =>
      normalizeSearchText(field).includes(normalizedQuery)
    )
  )
}

export function sortByText<T>(
  items: readonly T[],
  direction: TableSortDirection | null,
  getText: (item: T) => string
): T[] {
  if (!direction) return [...items]
  return [...items].sort((a, b) => {
    const result = collator.compare(getText(a), getText(b))
    return direction === 'ascending' ? result : -result
  })
}
