import type { DropdownItem, SortOption } from './types'

export async function defaultSearcher(query: string, items: DropdownItem[]) {
  if (query.trim() === '') return items
  const words = query.trim().toLowerCase().split(' ')
  return items.filter((item) => {
    const name = item.name.toLowerCase()
    return words.every((word) => name.includes(word))
  })
}

export function getDefaultSortOptions(): SortOption[] {
  return [
    {
      name: 'Default',
      id: 'default',
      sorter: ({ items }) => items.slice()
    },
    {
      name: 'A-Z',
      id: 'a-z',
      sorter: ({ items }) =>
        items.slice().sort((a, b) => {
          return a.name.localeCompare(b.name)
        })
    }
  ]
}
