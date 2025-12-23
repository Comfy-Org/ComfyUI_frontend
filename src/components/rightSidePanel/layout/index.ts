import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

/**
 * Searches widgets in a list and returns search results.
 * Filters by name, localized label, type, and user-input value.
 * Performs basic tokenization of the query string.
 */
export function searchWidgets<T extends { widget: IBaseWidget }[]>(
  list: T,
  query: string
): T {
  if (query.trim() === '') {
    return list
  }
  const words = query.trim().toLowerCase().split(' ')
  return list.filter(({ widget }) => {
    const label = widget.label?.toLowerCase()
    const name = widget.name.toLowerCase()
    const type = widget.type.toLowerCase()
    const value = widget.value?.toString().toLowerCase()
    return words.every(
      (word) =>
        name.includes(word) ||
        label?.includes(word) ||
        type?.includes(word) ||
        value?.includes(word)
    )
  }) as T
}
