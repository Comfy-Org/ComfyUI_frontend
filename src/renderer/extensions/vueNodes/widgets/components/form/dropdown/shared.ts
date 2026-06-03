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

export function getDefaultSortOptions(): SortOption<AssetSortOption>[] {
  return [
    createSortOption('default', t('assetBrowser.sortUnsorted')),
    createSortOption('name-asc', t('assetBrowser.sortAZ'))
  ]
}

// Model picker sort options, matching the Model Library sidebar. FormDropdownMenu
// buckets items under per-base-model headings and decides bucket ORDER from the
// asc/desc id, so both base-model options share one sorter that only clamps a
// stable within-bucket order by name.
const sortBucketByName: SortOption['sorter'] = ({ items }) =>
  sortAssets(items, 'name-asc')

export function getModelSortOptions(): SortOption[] {
  return [
    {
      id: 'base-model-asc',
      name: t('assets.sort.baseModelAsc'),
      sorter: sortBucketByName
    },
    {
      id: 'base-model-desc',
      name: t('assets.sort.baseModelDesc'),
      sorter: sortBucketByName
    },
    createSortOption('name-asc', t('assets.sort.nameAsc')),
    createSortOption('name-desc', t('assets.sort.nameDesc'))
  ]
}
