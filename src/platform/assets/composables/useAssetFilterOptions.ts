import { uniqWith } from 'es-toolkit'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { SelectOption } from '@/components/input/types'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/**
 * Composable that extracts available filter options from asset data
 * Provides reactive computed properties for file formats and base models
 */
export function useAssetFilterOptions(assets: MaybeRefOrGetter<AssetItem[]>) {
  /**
   * Extract unique file formats from asset names
   * Returns sorted SelectOption array with extensions
   */
  const availableFileFormats = computed<SelectOption[]>(() => {
    const assetList = toValue(assets)
    const extensions = assetList
      .map((asset) => {
        const extension = asset.name.split('.').pop()
        return extension && extension !== asset.name ? extension : null
      })
      .filter((extension): extension is string => extension !== null)

    const uniqueExtensions = uniqWith(extensions, (a, b) => a === b)

    return uniqueExtensions.sort().map((format) => ({
      name: `.${format}`,
      value: format
    }))
  })

  /**
   * Extract unique base models from asset user metadata
   * Returns sorted SelectOption array with base model names
   */
  const availableBaseModels = computed<SelectOption[]>(() => {
    const assetList = toValue(assets)
    const models = assetList
      .map((asset) => asset.user_metadata?.base_model)
      .filter(
        (baseModel): baseModel is string =>
          baseModel !== undefined && typeof baseModel === 'string'
      )

    const uniqueModels = uniqWith(models, (a, b) => a === b)

    return uniqueModels.sort().map((model) => ({
      name: model,
      value: model
    }))
  })

  return {
    availableFileFormats,
    availableBaseModels
  }
}
