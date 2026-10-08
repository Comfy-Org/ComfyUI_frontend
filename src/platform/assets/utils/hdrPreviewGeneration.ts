import { toValue, watch } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { attachPreview } from '@/platform/assets/utils/attachPreview'
import { getAssetFileUrl } from '@/platform/assets/utils/assetUrlUtil'
import { reportError } from '@/platform/telemetry/reportError'
import type { PagedList } from '@/utils/pagedList'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

const RENDER_TIMEOUT_MS = 30_000

let queue: Promise<unknown> = Promise.resolve()

function renderHdrThumbnail(url: string, filename: string) {
  const run = queue.then(() => renderInWorker(url, filename))
  queue = run.catch(() => null)
  return run
}

function renderInWorker(url: string, filename: string) {
  const worker = new Worker(
    new URL('../../hdr/hdrThumbnail.ts', import.meta.url),
    { type: 'module' }
  )
  return new Promise<Blob>((resolve, reject) => {
    setTimeout(
      () => reject(new Error('HDR thumbnail timed out')),
      RENDER_TIMEOUT_MS
    )
    worker.onmessage = ({ data }) =>
      data instanceof Blob ? resolve(data) : reject(data)
    worker.onerror = reject
    worker.postMessage({ url: new URL(url, location.href).href, filename })
  }).finally(() => worker.terminate())
}

async function generatePreview(asset: AssetItem, list: PagedList<AssetItem>) {
  try {
    const blob = await renderHdrThumbnail(getAssetFileUrl(asset), asset.name)
    await attachPreview(asset, blob)
    await list.invalidate()
  } catch (error) {
    reportError(error, {
      errorType: 'error_generating_asset_preview',
      surface: 'assets'
    })
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
        if (
          (asset.preview_id && asset.preview_id !== asset.id) ||
          !isHdrImageFilename(asset.name)
        )
          continue
        handledIds.add(asset.id)
        void generatePreview(asset, list)
      }
    },
    { immediate: true }
  )
}
