import { assetContentUrl } from '@/platform/assets/utils/assetUrlUtil'
import { isHdrImageFilename, isHdrImageUrl } from '@/utils/hdrFormatUtil'
import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import { api } from '@/scripts/api'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { isImageResult, isVideoResult } from '@/utils/resultItem'

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

interface PreviewUrlOptions {
  fullRes?: boolean
  previewFormat?: string
  rand?: string
}

export function resultItemPreviewUrl(
  item: AugmentedResultItem,
  { fullRes = false, previewFormat = '', rand = '' }: PreviewUrlOptions = {}
): string {
  if (isHdrImageFilename(item.filename))
    return (
      item.previewUrl ??
      (item.preview_id ? assetContentUrl(item.preview_id) : '')
    )
  if (isVideoResult(item) && item.preview_id)
    return item.previewUrl ?? assetContentUrl(item.preview_id)
  if (fullRes) return resultItemUrl(item)
  if (item.previewUrl !== undefined) return item.previewUrl
  if (item.url !== undefined) return item.url
  const params = resultItemUrlParams(item)
  if (isImageResult(item)) appendCloudResParam(params, item.filename)
  const url = item.filename ? api.apiURL('/view?' + params) : ''
  return url + previewFormat + rand
}

export function getHdrPreviewUrl(url: string | undefined): string | undefined {
  const previewId =
    url &&
    isHdrImageUrl(url) &&
    new URL(url, window.location.origin).searchParams.get('preview_id')
  return previewId ? assetContentUrl(previewId) : undefined
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
