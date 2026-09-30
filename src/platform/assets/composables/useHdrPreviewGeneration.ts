import type { EffectScope } from 'vue'
import { effectScope, onScopeDispose, toValue, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAssetsQuery } from '@/platform/assets/composables/useAssetsQuery'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { attachPreview } from '@/platform/assets/utils/assetPreviewUtil'
import { getAssetFileUrl } from '@/platform/assets/utils/assetUrlUtil'
import { reportError } from '@/platform/telemetry/reportError'
import { renderHdrThumbnail } from '@/platform/hdr/hdrThumbnail'
import type { PagedList } from '@/utils/pagedList'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

async function generatePreview(asset: AssetItem, list: PagedList<AssetItem>) {
  try {
    const blob = await renderHdrThumbnail(getAssetFileUrl(asset), asset.name)
    await attachPreview(asset, blob)
    await list.invalidate()
  } catch (error) {
    reportError(error, { errorType: 'error_generating_asset_preview' })
  }
}

function generatePreviewsForNewAssets(list: PagedList<AssetItem>) {
  const handledIds = new Set<string>()
  let newestPreexisting: number | undefined

  watch(
    () => ({
      isSettled:
        !toValue(list.isLoading) &&
        (toValue(list.items).length > 0 || !toValue(list.hasMore)),
      items: [...toValue(list.items)]
    }),
    ({ isSettled, items }) => {
      if (newestPreexisting === undefined) {
        if (!isSettled) return
        newestPreexisting = items.reduce(
          (newest, asset) => Math.max(newest, Date.parse(asset.created_at)),
          -Infinity
        )
        return
      }

      for (const asset of items) {
        if (handledIds.has(asset.id)) continue
        if (Date.parse(asset.created_at) <= newestPreexisting) continue
        if (asset.preview_id || !isHdrImageFilename(asset.name)) continue
        handledIds.add(asset.id)
        void generatePreview(asset, list)
      }
    },
    { immediate: true }
  )
}

export function useHdrPreviewGeneration() {
  const { flags } = useFeatureFlags()
  let scope: EffectScope | undefined

  watch(
    () => flags.assetsEnabled,
    (assetsEnabled) => {
      scope?.stop()
      scope = undefined
      if (!assetsEnabled) return

      scope = effectScope()
      scope.run(() => {
        generatePreviewsForNewAssets(useAssetsQuery({ tags_any: ['input'] }))
        generatePreviewsForNewAssets(
          useAssetsQuery({ tags_any: ['output', 'temp'] })
        )
      })
    },
    { immediate: true }
  )

  onScopeDispose(() => scope?.stop())
}
