import { computed, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useLocalModelLibrarySource } from '@/composables/sidebarTabs/useLocalModelLibrarySource'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { isCloud } from '@/platform/distribution/types'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

/**
 * Composable for fetching and transforming asset data for Vue node widgets.
 * Provides reactive asset data based on node type with automatic category detection.
 * Uses store-based caching to avoid duplicate fetches across multiple instances.
 *
 * Cloud reads from the assets store; desktop/localhost reads from the local
 * Model Library source (which enumerates /models/<folder>).
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

    watch(
      () => toValue(nodeType),
      async (currentNodeType) => {
        if (!currentNodeType) {
          return
        }

        const isLoading = assetsStore.isModelLoading(currentNodeType)
        const hasBeenInitialized = assetsStore.hasAssetKey(currentNodeType)

        if (!isLoading && !hasBeenInitialized) {
          await assetsStore.updateModelsForNodeType(currentNodeType)
        }
      },
      { immediate: true }
    )

    return {
      category,
      assets,
      isLoading,
      error
    }
  }

  // Local mode (desktop / localhost): the unified Model Library source has
  // already enumerated /models/<folder>. Look up the node's category via the
  // shared modelToNodeStore and return only the assets in that directory so
  // each load-node's picker is scoped to the right kind of files.
  const localSource = useLocalModelLibrarySource()
  const modelToNodeStore = useModelToNodeStore()

  const category = computed(() => {
    const resolvedType = toValue(nodeType)
    return resolvedType
      ? modelToNodeStore.getCategoryForNodeType(resolvedType)
      : undefined
  })

  const assets = computed<AssetItem[]>(() => {
    const cat = category.value
    if (!cat) return []
    return localSource.assets.value.filter((a) => a.metadata?.directory === cat)
  })

  return {
    category,
    assets,
    isLoading: localSource.isLoading,
    error: computed<Error | null>(() => null)
  }
}
