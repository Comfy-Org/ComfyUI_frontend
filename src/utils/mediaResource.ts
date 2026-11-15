import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { hdrPreviewAssetUrl, isHdrImageFilename } from '@/utils/hdrFormatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'

type MediaFile = Pick<AugmentedResultItem, 'filename'> &
  Partial<
    Pick<
      AugmentedResultItem,
      | 'type'
      | 'subfolder'
      | 'format'
      | 'frame_rate'
      | 'url'
      | 'previewUrl'
      | 'thumbnailUrl'
      | 'preview_id'
    >
  >

export interface MediaSources {
  originalUrl: string
  displayUrl: string
  previewUrl: string
  thumbnailUrl: string
  canEditPixels: boolean
}

interface MediaSourceOptions {
  previewFormat?: string
  rand?: string
  viewParams?: URLSearchParams
}

function resultItemUrlParams(item: MediaFile): URLSearchParams {
  const params = new URLSearchParams()
  params.set('filename', item.filename)
  params.set('type', item.type ?? '')
  if (item.subfolder !== undefined) params.set('subfolder', item.subfolder)
  if (item.format) params.set('format', item.format)
  if (item.frame_rate) params.set('frame_rate', item.frame_rate.toString())
  return params
}

export function resultItemUrl(
  item: MediaFile,
  viewParams = resultItemUrlParams(item)
): string {
  if (item.url !== undefined) return item.url
  if (!item.filename) return ''
  return api.apiURL('/view?' + viewParams)
}

export function resolveMediaSources(
  item: MediaFile,
  options: MediaSourceOptions = {}
): MediaSources {
  const originalUrl =
    item.url ?? resultItemUrl(item, options.viewParams) + (options.rand ?? '')
  const requiresPreview = isHdrImageFilename(item.filename)
  const params = new URLSearchParams(
    options.viewParams ?? resultItemUrlParams(item)
  )
  appendCloudResParam(params, item.filename)
  const previewUrl = !requiresPreview
    ? (item.previewUrl ??
      item.url ??
      (item.filename
        ? api.apiURL('/view?' + params) +
          (options.previewFormat ?? '') +
          (options.rand ?? '')
        : ''))
    : (item.previewUrl ??
      (item.preview_id ? hdrPreviewAssetUrl(item.preview_id) : ''))

  return {
    originalUrl,
    displayUrl: requiresPreview ? previewUrl : originalUrl,
    previewUrl,
    thumbnailUrl:
      item.thumbnailUrl ??
      item.previewUrl ??
      (requiresPreview ? undefined : item.url) ??
      thumbnailUrl(previewUrl),
    canEditPixels: !requiresPreview
  }
}

function thumbnailUrl(url: string): string {
  if (!url.startsWith('/') || url.startsWith('//')) return url
  const parsed = new URL(url, window.location.origin)
  if (!parsed.pathname.endsWith('/view')) return url
  const filename = parsed.searchParams.get('filename') ?? undefined
  if (filename && getMediaTypeFromFilename(filename) !== 'image') return url
  appendCloudResParam(parsed.searchParams, filename)
  if (
    !filename?.toLowerCase().endsWith('.svg') &&
    !parsed.searchParams.has('preview')
  )
    parsed.searchParams.set('preview', 'webp;75')
  return `${parsed.pathname}${parsed.search}`
}

export function appendCloudResParam(
  params: URLSearchParams,
  filename?: string
): void {
  if (!isCloud) return
  if (
    filename &&
    (getMediaTypeFromFilename(filename) !== 'image' ||
      filename.toLowerCase().endsWith('.svg'))
  )
    return
  params.set('res', '512')
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
