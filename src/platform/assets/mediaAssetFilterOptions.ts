export type MediaAssetDateFilter = '' | 'today' | 'week' | 'month' | 'year'

interface FilterOption<T extends string> {
  value: T
  label: string
}

export const mediaTypeFilterOptions: FilterOption<string>[] = [
  { value: 'image', label: 'sideToolbar.mediaAssets.filterImage' },
  { value: 'video', label: 'sideToolbar.mediaAssets.filterVideo' },
  { value: 'audio', label: 'sideToolbar.mediaAssets.filterAudio' },
  { value: '3d', label: 'sideToolbar.mediaAssets.filter3D' },
  { value: 'text', label: 'sideToolbar.mediaAssets.filterText' }
]

export const dateFilterOptions: FilterOption<MediaAssetDateFilter>[] = [
  { value: '', label: 'sideToolbar.mediaAssets.dateAll' },
  { value: 'today', label: 'sideToolbar.mediaAssets.dateToday' },
  { value: 'week', label: 'sideToolbar.mediaAssets.datePastWeek' },
  { value: 'month', label: 'sideToolbar.mediaAssets.datePastMonth' },
  { value: 'year', label: 'sideToolbar.mediaAssets.dateThisYear' }
]
