import { computed } from 'vue'

import type { SelectOption } from '@/components/input/types'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/**
 * Composable that extracts available filter options from asset data
 * Provides reactive computed properties for file formats and base models
 */
export function useAssetFilterOptions(assets: AssetItem[] = []) {
  /**
   * Extract unique file formats from asset names
   * Returns sorted SelectOption array with extensions
   */
  const availableFileFormats = computed<SelectOption[]>(() => {
    const formats = new Set<string>()

    assets.forEach((asset) => {
      const extension = asset.name.split('.').pop()
      if (extension && extension !== asset.name) {
        // Only add if there was actually an extension (not just the filename)
        formats.add(extension)
      }
    })

    return Array.from(formats)
      .sort()
      .map((format) => ({
        name: `.${format}`,
        value: format
      }))
  })

  /**
   * Extract unique base models from asset user metadata
   * Returns sorted SelectOption array with base model names
   */
  const availableBaseModels = computed<SelectOption[]>(() => {
    const models = new Set<string>()

    assets.forEach((asset) => {
      const baseModel = asset.user_metadata?.base_model
      if (baseModel && typeof baseModel === 'string') {
        models.add(baseModel)
      }
    })

    return Array.from(models)
      .sort()
      .map((model) => ({
        name: model,
        value: model
      }))
  })

  return {
    availableFileFormats,
    availableBaseModels
  }
}
