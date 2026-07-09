/**
 * Single source of the media-assets filter facet values and their i18n label
 * keys, shared by the filter menu (which renders the option rows) and the
 * filter bar (which labels the applied-filter chips) so the two never drift.
 */

export interface FacetValue {
  value: string
  labelKey: string
}

export const MEDIA_TYPE_VALUES: FacetValue[] = [
  { value: 'image', labelKey: 'sideToolbar.mediaAssets.filterImage' },
  { value: 'video', labelKey: 'sideToolbar.mediaAssets.filterVideo' },
  { value: 'audio', labelKey: 'sideToolbar.mediaAssets.filterAudio' },
  { value: '3d', labelKey: 'sideToolbar.mediaAssets.filter3D' },
  { value: 'text', labelKey: 'sideToolbar.mediaAssets.filterText' }
]

export const DATE_VALUES: FacetValue[] = [
  { value: '', labelKey: 'sideToolbar.mediaAssets.dateAll' },
  { value: 'today', labelKey: 'sideToolbar.mediaAssets.dateToday' },
  { value: 'week', labelKey: 'sideToolbar.mediaAssets.datePastWeek' },
  { value: 'month', labelKey: 'sideToolbar.mediaAssets.datePastMonth' },
  { value: 'year', labelKey: 'sideToolbar.mediaAssets.dateThisYear' }
]

export function labelKeyForValue(
  values: FacetValue[],
  value: string
): string | undefined {
  return values.find((facetValue) => facetValue.value === value)?.labelKey
}
