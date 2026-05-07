import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetAdditionalTags } from '@/platform/assets/utils/assetMetadataUtils'

/**
 * Aggregates unique additional_tags across a set of assets.
 * Returns a sorted array of all distinct tag strings.
 */
export function useAvailableMediaTags(assets: MaybeRefOrGetter<AssetItem[]>) {
  return computed(() =>
    [
      ...new Set(toValue(assets).flatMap((a) => getAssetAdditionalTags(a)))
    ].sort()
  )
}
