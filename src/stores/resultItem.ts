import { appendCloudResParam } from '@/platform/distribution/cloudPreviewUtil'
import type { ResultItem } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import type { SerializedNodeId } from '@/types/nodeId'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

export interface AugmentedResultItem extends ResultItem {
  mediaType: string
  nodeId: SerializedNodeId
  assetId?: string
  display_name?: string
  content?: string
  format?: string
  frame_rate?: number
  url?: string
  previewUrl?: string
}

function resultItemUrlParams(item: AugmentedResultItem): URLSearchParams {
  const params = new URLSearchParams()
  params.set('filename', item.filename ?? '')
  params.set('type', item.type ?? '')
  params.set('subfolder', item.subfolder ?? '')
  if (item.format) params.set('format', item.format)
  if (item.frame_rate) params.set('frame_rate', item.frame_rate.toString())
  return params
}

export function resultItemUrl(item: AugmentedResultItem): string {
  if (item.url !== undefined) return item.url
  if (!item.filename) return ''
  return api.apiURL('/view?' + resultItemUrlParams(item))
}

export function resultItemPreviewUrl(item: AugmentedResultItem): string {
  if (item.previewUrl !== undefined) return item.previewUrl
  if (!isImageResult(item)) return resultItemUrl(item)
  const params = resultItemUrlParams(item)
  appendCloudResParam(params, item.filename)
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

const isVideoBySuffix = (item: AugmentedResultItem): boolean =>
  getMediaTypeFromFilename(item.filename) === 'video'
const isImageBySuffix = (item: AugmentedResultItem): boolean =>
  getMediaTypeFromFilename(item.filename) === 'image'
const isAudioBySuffix = (item: AugmentedResultItem): boolean =>
  getMediaTypeFromFilename(item.filename) === 'audio'

export function isVhsFormat(item: AugmentedResultItem): boolean {
  return !!item.format && !!item.frame_rate
}

export function isVideoResult(item: AugmentedResultItem): boolean {
  const isVideoByType =
    item.mediaType === 'video' || !!item.format?.startsWith('video/')
  return (
    isVideoBySuffix(item) ||
    (isVideoByType && !isImageBySuffix(item) && !isAudioBySuffix(item))
  )
}

export function isImageResult(item: AugmentedResultItem): boolean {
  return (
    isImageBySuffix(item) ||
    (item.mediaType === 'images' &&
      !isVideoBySuffix(item) &&
      !isAudioBySuffix(item))
  )
}

export function isAudioResult(item: AugmentedResultItem): boolean {
  const isAudioByType =
    item.mediaType === 'audio' || !!item.format?.startsWith('audio/')
  return (
    isAudioBySuffix(item) ||
    (isAudioByType && !isImageBySuffix(item) && !isVideoBySuffix(item))
  )
}

export function is3DResult(item: AugmentedResultItem): boolean {
  return getMediaTypeFromFilename(item.filename) === '3D'
}

export function isTextResult(item: AugmentedResultItem): boolean {
  return (
    item.mediaType === 'text' ||
    getMediaTypeFromFilename(item.filename) === 'text'
  )
}

export function resultItemHtmlVideoType(
  item: AugmentedResultItem
): string | undefined {
  if (item.filename?.endsWith('.webm')) return 'video/webm'
  if (item.filename?.endsWith('.mp4')) return 'video/mp4'
  if (item.filename?.endsWith('.mov')) return 'video/quicktime'
  if (isVhsFormat(item)) {
    if (item.format?.endsWith('webm')) return 'video/webm'
    if (item.format?.endsWith('mp4')) return 'video/mp4'
  }
  return undefined
}

export function resultItemHtmlAudioType(
  item: AugmentedResultItem
): string | undefined {
  if (item.filename?.endsWith('.mp3')) return 'audio/mpeg'
  if (item.filename?.endsWith('.wav')) return 'audio/wav'
  if (item.filename?.endsWith('.ogg')) return 'audio/ogg'
  if (item.filename?.endsWith('.flac')) return 'audio/flac'
  return undefined
}

export function resultItemSupportsPreview(item: AugmentedResultItem): boolean {
  return (
    isImageResult(item) ||
    isVideoResult(item) ||
    isAudioResult(item) ||
    is3DResult(item) ||
    isTextResult(item)
  )
}

export function filterPreviewableResults(
  items: readonly AugmentedResultItem[]
): AugmentedResultItem[] {
  return items.filter(resultItemSupportsPreview)
}

export function findResultIndexByUrl(
  items: readonly AugmentedResultItem[],
  url?: string
): number {
  if (!url) return 0
  const idx = items.findIndex((item) => resultItemUrl(item) === url)
  return idx >= 0 ? idx : 0
}
