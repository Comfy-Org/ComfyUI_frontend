import { assetContentUrl } from '@/platform/assets/utils/assetUrlUtil'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { api } from '@/scripts/api'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { isImageResult } from '@/utils/resultItem'

function resultItemUrlParams(item: AugmentedResultItem): URLSearchParams {
  const params = new URLSearchParams()
  params.set('filename', item.filename)
  params.set('type', item.type ?? '')
  params.set('subfolder', item.subfolder)
  if (item.format) params.set('format', item.format)
  if (item.frame_rate) params.set('frame_rate', item.frame_rate.toString())
  return params
}

export function resultItemUrl(item: AugmentedResultItem): string {
  if (item.url !== undefined) return item.url
  if (!item.filename) return ''
  return api.apiURL('/view?' + resultItemUrlParams(item))
}

export function resultItemPreviewUrl(
  item: AugmentedResultItem,
  options: { fullRes?: boolean } = {}
): string {
  if (item.previewUrl !== undefined) return item.previewUrl
  if (isHdrImageFilename(item.filename))
    return item.preview_id ? assetContentUrl(item.preview_id) : ''
  if (!isImageResult(item)) return resultItemUrl(item)
  const params = resultItemUrlParams(item)
  if (!options.fullRes) appendCloudResParam(params, item.filename)
  return api.apiURL('/view?' + params)
}

export function resultItemVhsAdvancedPreviewUrl(
  item: AugmentedResultItem
): string {
  return api.apiURL('/viewvideo?' + resultItemUrlParams(item))
}

export function resultItemUrlWithTimestamp(item: AugmentedResultItem): string {
  return `${resultItemUrl(item)}&t=${+new Date()}`
}

export function findResultIndexByUrl(
  items: readonly AugmentedResultItem[],
  url?: string
): number {
  if (!url) return 0
  const idx = items.findIndex((item) => resultItemUrl(item) === url)
  return idx >= 0 ? idx : 0
}
