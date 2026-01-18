import { computed, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { DropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

/**
 * Composable for fetching and transforming asset data for Vue node widgets.
 * Provides reactive asset data based on node type with automatic category detection.
 * Uses store-based caching to avoid duplicate fetches across multiple instances.
 *
 * Cloud-only composable - returns empty data when not in cloud environment.
 *
 * @param nodeType - ComfyUI node type (ref, getter, or plain value). Can be undefined.
 *   Accepts: ref('CheckpointLoaderSimple'), () => 'CheckpointLoaderSimple', or 'CheckpointLoaderSimple'
 * @returns Reactive data including category, assets, dropdown items, loading state, and errors
 */
export function useAssetWidgetData(
  nodeType: MaybeRefOrGetter<string | undefined>
) {
  if (isCloud) {
    const assetsStore = useAssetsStore()
    const modelToNodeStore = useModelToNodeStore()

    const category = computed(() => {
      const resolvedType = toValue(nodeType)
      return resolvedType
        ? modelToNodeStore.getCategoryForNodeType(resolvedType)
        : undefined
    })

    const assets = computed<AssetItem[]>(() => {
      const resolvedType = toValue(nodeType)
      return resolvedType ? (assetsStore.getAssets(resolvedType) ?? []) : []
    })

    const isLoading = computed(() => {
      const resolvedType = toValue(nodeType)
      return resolvedType ? assetsStore.isModelLoading(resolvedType) : false
    })

    const error = computed<Error | null>(() => {
      const resolvedType = toValue(nodeType)
      return resolvedType ? (assetsStore.getError(resolvedType) ?? null) : null
    })

    const dropdownItems = computed<DropdownItem[]>(() => {
      return (assets.value ?? []).map((asset) => ({
        id: asset.id,
        name:
          (asset.user_metadata?.filename as string | undefined) ?? asset.name,
        label: asset.name,
        mediaSrc: asset.preview_url ?? '',
        metadata: ''
      }))
    })

    watch(
      () => toValue(nodeType),
      async (currentNodeType) => {
        if (!currentNodeType) {
          return
        }

        const existingAssets = assetsStore.getAssets(currentNodeType) ?? []
        const hasData = existingAssets.length > 0

        if (!hasData) {
          await assetsStore.updateModelsForNodeType(currentNodeType)
        }
      },
      { immediate: true }
    )

    return {
      category,
      assets,
      dropdownItems,
      isLoading,
      error
    }
  }

  return {
    category: computed(() => undefined),
    assets: computed(() => []),
    dropdownItems: computed(() => []),
    isLoading: computed(() => false),
    error: computed(() => null)
  }
}
