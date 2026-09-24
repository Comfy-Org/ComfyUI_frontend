import type { LightboxItem } from '@/types/lightboxItem'
import {
  getMediaTypeFromFilename,
  htmlVideoTypeForFilename
} from '@/utils/formatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  isAudioResult,
  isImageResult,
  isTextResult,
  isVideoResult,
  resultItemHtmlVideoType
} from '@/utils/resultItem'
import { resultItemUrl, vhsAdvancedPreviewUrl } from '@/utils/resultItemUrl'

export function isLightboxRenderableFilename(filename: string): boolean {
  const mediaType = getMediaTypeFromFilename(filename)
  return (
    mediaType === 'image' ||
    mediaType === 'video' ||
    mediaType === 'audio' ||
    mediaType === 'text'
  )
}

export function fileLightboxItem(
  url: string,
  filename: string,
  advancedPreviewUrl?: string
): LightboxItem | undefined {
  switch (getMediaTypeFromFilename(filename)) {
    case 'image':
      return { kind: 'image', url, alt: filename }
    case 'video':
      return {
        kind: 'video',
        url,
        mimeType: htmlVideoTypeForFilename(filename),
        advancedPreviewUrl
      }
    case 'audio':
      return { kind: 'audio', url }
    case 'text':
      return { kind: 'text', url }
    default:
      return undefined
  }
}

function resultItemToLightboxItem(
  item: AugmentedResultItem
): LightboxItem | undefined {
  const url = resultItemUrl(item)

  if (isVideoResult(item)) {
    return {
      kind: 'video',
      url,
      mimeType: resultItemHtmlVideoType(item),
      advancedPreviewUrl: vhsAdvancedPreviewUrl(item)
    }
  }
  if (isImageResult(item)) return { kind: 'image', url, alt: item.filename }
  if (isAudioResult(item)) return { kind: 'audio', url }
  if (isTextResult(item)) return { kind: 'text', url, content: item.content }

  return undefined
}

/**
 * Drops records the lightbox cannot render, so navigation never lands on a
 * blank frame. Callers must take their selected index from the result.
 */
export function resultItemsToLightboxItems(
  items: readonly AugmentedResultItem[]
): LightboxItem[] {
  return items.flatMap((item) => {
    const lightboxItem = resultItemToLightboxItem(item)
    return lightboxItem ? [lightboxItem] : []
  })
}

export function findLightboxIndexByUrl(
  items: readonly LightboxItem[],
  url: string
): number | undefined {
  const index = items.findIndex((item) => item.url === url)
  return index >= 0 ? index : undefined
}
