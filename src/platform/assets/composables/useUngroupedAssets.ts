import { computedAsync } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import { useCachedRequest } from '@/composables/useCachedRequest'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'

export function useUngroupedAssets(
  assets: Ref<AssetItem[]>,
  groupByJob: Ref<boolean>
) {
  const { call: cachedResolve, cancel } = useCachedRequest((jobId: string) => {
    const asset = assets.value.find((a) => {
      const m = getOutputAssetMetadata(a.user_metadata)
      return m?.jobId === jobId
    })
    if (!asset) return Promise.resolve(null)
    const metadata = getOutputAssetMetadata(asset.user_metadata)!
    return resolveOutputAssetItems(metadata, {
      createdAt: asset.created_at
    })
  })

  const isResolving = ref(false)

  const resolvedAssets = computedAsync(
    async (onCancel) => {
      if (groupByJob.value) return []

      onCancel(() => cancel())

      const entries = assets.value.map((asset) => ({
        asset,
        metadata: getOutputAssetMetadata(asset.user_metadata)
      }))

      for (const { metadata } of entries) {
        if ((metadata?.outputCount ?? 1) > 1 && metadata?.jobId) {
          void cachedResolve(metadata.jobId)
        }
      }

      const result: AssetItem[] = []
      for (const { asset, metadata } of entries) {
        const count = metadata?.outputCount ?? 1
        if (count <= 1 || !metadata?.jobId) {
          result.push(asset)
          continue
        }
        const children = await cachedResolve(metadata.jobId)
        result.push(...(children?.length ? children : [asset]))
      }
      return result
    },
    [],
    isResolving
  )

  const ungroupedAssets = computed(() =>
    groupByJob.value ? assets.value : resolvedAssets.value
  )

  return { ungroupedAssets, isResolving }
}
