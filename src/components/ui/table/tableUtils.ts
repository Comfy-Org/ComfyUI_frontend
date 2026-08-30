export type TableSortDirection = 'ascending' | 'descending'

export function filterByQuery<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return items.filter((item) =>
    getSearchText(item).toLocaleLowerCase().includes(normalizedQuery)
  )
}

export function sortByText<T>(
  items: T[],
  direction: TableSortDirection,
  getText: (item: T) => string
): T[] {
  return items.toSorted((a, b) => {
    const result = getText(a).localeCompare(getText(b))
    return direction === 'ascending' ? result : -result
  })
}
