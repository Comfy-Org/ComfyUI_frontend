import type { ListAssetsData } from '@comfyorg/ingest-types'

type ListAssetsQuery = NonNullable<ListAssetsData['query']>

/** Cursor pagination rejects `last_access_time`, so it is not a valid sort here. */
export interface MediaAssetSort {
  sort: Exclude<NonNullable<ListAssetsQuery['sort']>, 'last_access_time'>
  order: NonNullable<ListAssetsQuery['order']>
}

export const DEFAULT_MEDIA_ASSET_SORT: MediaAssetSort = {
  sort: 'created_at',
  order: 'desc'
}

export const mediaAssetSortOptions: { value: MediaAssetSort; label: string }[] =
  [
    {
      value: DEFAULT_MEDIA_ASSET_SORT,
      label: 'sideToolbar.mediaAssets.sortNewestFirst'
    },
    {
      value: { sort: 'created_at', order: 'asc' },
      label: 'sideToolbar.mediaAssets.sortOldestFirst'
    },
    {
      value: { sort: 'name', order: 'asc' },
      label: 'sideToolbar.mediaAssets.sortAToZ'
    },
    {
      value: { sort: 'name', order: 'desc' },
      label: 'sideToolbar.mediaAssets.sortZToA'
    }
  ]
