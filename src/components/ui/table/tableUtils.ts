export type TableSortDirection = 'ascending' | 'descending'

export function filterByQuery<T>(
  items: T[],
  query: string,
  getSearchFields: (item: T) => string[]
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return items.filter((item) =>
    getSearchFields(item).some((field) =>
      field.toLocaleLowerCase().includes(normalizedQuery)
    )
  )
}

export function sortByText<T>(
  items: T[],
  direction: TableSortDirection | null,
  getText: (item: T) => string
): T[] {
  if (!direction) return items
  return [...items].sort((a, b) => {
    const result = getText(a).localeCompare(getText(b))
    return direction === 'ascending' ? result : -result
  })
}
