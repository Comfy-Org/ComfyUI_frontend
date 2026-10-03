import { t } from '@/i18n'
import type { AssetSortOption } from '@/platform/assets/types/filterTypes'
import { sortAssets } from '@/platform/assets/utils/assetSortUtils'

import type { FormDropdownItem, SortOption } from './types'

/**
 * Marker class for the dropdown's sub-popover panels (Sort / Ownership /
 * Base-model). Those panels teleport to `document.body`, so they render outside
 * the menu's DOM subtree; the outside-press dismiss logic uses this class to
 * recognize a press inside them as still "inside" the dropdown.
 */
export const DROPDOWN_PANEL_CLASS = 'comfy-form-dropdown-panel'

export async function defaultSearcher(
  query: string,
  items: FormDropdownItem[]
) {
  if (query.trim() === '') return items
  const words = query.trim().toLowerCase().split(' ')
  return items.filter((item) => {
    const name = item.name.toLowerCase()
    const label = item.label?.toLowerCase() ?? ''
    return words.every((word) => name.includes(word) || label.includes(word))
  })
}

/**
 * Create a SortOption that delegates to the shared sortAssets utility
 */
function createSortOption(
  id: AssetSortOption,
  name: string
): SortOption<AssetSortOption> {
  return {
    id,
    name,
    sorter: ({ items }) => sortAssets(items, id)
  }
}

export function getDefaultSortOptions(): SortOption<AssetSortOption>[] {
  return [
    createSortOption('default', t('assetBrowser.sortUnsorted')),
    createSortOption('name-asc', t('assetBrowser.sortAZ'))
  ]
}
