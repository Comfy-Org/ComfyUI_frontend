/**
 * Shared asset sorting utilities
 * Used by both AssetBrowser and FormDropdown
 */

import type { AssetSortOption } from '../types/filterTypes'

/**
 * Minimal interface for sortable items
 * Works with both AssetItem and FormDropdownItem
 */
export interface SortableItem {
  name: string
  label?: string
  author?: string
  created_at?: string | null
}

function getDisplayName(item: SortableItem): string {
  return item.label ?? item.name
}

function getAuthorKey(item: SortableItem): string {
  return item.author?.trim() ?? ''
}

/**
 * Sort items by the specified sort option
 * @param items - Array of sortable items
 * @param sortBy - Sort option from AssetSortOption
 * @returns New sorted array (does not mutate input)
 */
export function sortAssets<T extends SortableItem>(
  items: readonly T[],
  sortBy: AssetSortOption
): T[] {
  if (sortBy === 'default') {
    return items.slice()
  }

  const sorted = items.slice()

  switch (sortBy) {
    case 'name-desc':
      return sorted.sort((a, b) =>
        getDisplayName(b).localeCompare(getDisplayName(a), undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )
    case 'recent':
      return sorted.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      )
    case 'oldest':
      return sorted.sort(
        (a, b) =>
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime()
      )
    case 'author-asc':
    case 'author-desc': {
      const direction = sortBy === 'author-desc' ? -1 : 1
      const hasAuthor = (i: SortableItem) => !!i.author?.trim()
      return sorted.sort((a, b) => {
        const ah = hasAuthor(a)
        const bh = hasAuthor(b)
        // Always sink unknown-author rows to the bottom, irrespective of
        // direction — keeps the "Other" bucket visually anchored at the end.
        if (ah !== bh) return ah ? -1 : 1
        const authorCmp =
          direction *
          getAuthorKey(a).localeCompare(getAuthorKey(b), undefined, {
            sensitivity: 'base'
          })
        if (authorCmp !== 0) return authorCmp
        return getDisplayName(a).localeCompare(getDisplayName(b), undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      })
    }
    case 'name-asc':
    default:
      return sorted.sort((a, b) =>
        getDisplayName(a).localeCompare(getDisplayName(b), undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )
  }
}
