import { t } from '@/i18n'
import type { AssetSortOption } from '@/platform/assets/types/filterTypes'
import { sortAssets } from '@/platform/assets/utils/assetSortUtils'

import type { FormDropdownItem, SortOption } from './types'

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

/**
 * The first option uses the `'default'` id (preserves server order) but is
 * labeled "Recent" because the cloud assets API returns items sorted by
 * `create_time DESC` (newest first). FormDropdown and FormDropdownMenuActions
 * rely on the `'default'` id as a sentinel for the unmodified sort state, so
 * we keep the id while presenting a clearer label to users.
 */
export function getDefaultSortOptions(): SortOption<AssetSortOption>[] {
  return [
    createSortOption('default', t('assetBrowser.sortRecent')),
    createSortOption('name-asc', t('assetBrowser.sortAZ'))
  ]
}
