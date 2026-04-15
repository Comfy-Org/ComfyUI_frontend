import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { PropertySuggestion } from '@/platform/assets/schemas/userPropertySchema'
import { getAssetUserProperties } from '@/platform/assets/schemas/userPropertySchema'

/**
 * Aggregates property key definitions across a set of assets.
 * Returns a Map of known property keys with their type and constraints,
 * used for autocomplete when adding new properties.
 */
export function usePropertySuggestions(assets: MaybeRefOrGetter<AssetItem[]>) {
  return computed(() => {
    const suggestions = new Map<string, PropertySuggestion>()

    for (const asset of toValue(assets)) {
      const props = getAssetUserProperties(asset.user_metadata)
      for (const [key, prop] of Object.entries(props)) {
        if (suggestions.has(key)) continue
        const suggestion: PropertySuggestion = { type: prop.type }
        if (prop.type === 'number') {
          if (prop.min !== undefined) suggestion.min = prop.min
          if (prop.max !== undefined) suggestion.max = prop.max
        }
        suggestions.set(key, suggestion)
      }
    }

    return suggestions
  })
}
