import { toValue, watch } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { attachPreview } from '@/platform/assets/utils/attachPreview'
import { getAssetFileUrl } from '@/platform/assets/utils/assetUrlUtil'
import { reportError } from '@/platform/telemetry/reportError'
import type { PagedList } from '@/utils/pagedList'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

async function generatePreview(asset: AssetItem, list: PagedList<AssetItem>) {
  try {
    const { renderHdrThumbnail } = await import('@/platform/hdr/hdrThumbnail')
    const blob = await renderHdrThumbnail(getAssetFileUrl(asset), asset.name)
    await attachPreview(asset, blob)
    await list.invalidate()
  } catch (error) {
    reportError(error, { errorType: 'error_generating_asset_preview' })
  }
}

export function generatePreviewsForNewAssets(list: PagedList<AssetItem>) {
  const handledIds = new Set<string>()
  let newestPreexisting: number | undefined

  watch(
    [() => [...toValue(list.items)], () => toValue(list.hasMore)],
    ([items, hasMore]) => {
      if (newestPreexisting === undefined) {
        if (items.length === 0 && hasMore) return
        newestPreexisting = items[0]
          ? Date.parse(items[0].created_at)
          : Date.now() - 24 * 60 * 60 * 1000
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
