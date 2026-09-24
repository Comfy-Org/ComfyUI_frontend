import type { LightboxItem } from '@/types/lightboxItem'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  htmlVideoTypeForFilename,
  isAudioResult,
  isImageResult,
  isTextResult,
  isVideoResult,
  resultItemHtmlVideoType
} from '@/utils/resultItem'
import {
  resultItemUrl,
  resultItemVhsAdvancedPreviewUrl
} from '@/utils/resultItemUrl'

export function fileLightboxItem(
  url: string,
  filename: string,
  advancedPreviewUrl?: string
): LightboxItem {
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
      return { kind: 'unsupported', url }
  }
}

/**
 * Adapts a queue/result record into the lightbox's rendering contract.
 *
 * Total by construction: every record maps to exactly one item so caller-side
 * indices (`findResultIndexByUrl`, `findActiveIndex`) stay valid.
 */
function resultItemToLightboxItem(item: AugmentedResultItem): LightboxItem {
  const url = resultItemUrl(item)

  if (isVideoResult(item)) {
    return {
      kind: 'video',
      url,
      mimeType: resultItemHtmlVideoType(item),
      advancedPreviewUrl: resultItemVhsAdvancedPreviewUrl(item)
    }
  }
  if (isImageResult(item)) return { kind: 'image', url, alt: item.filename }
  if (isAudioResult(item)) return { kind: 'audio', url }
  if (isTextResult(item)) return { kind: 'text', url, content: item.content }

  return { kind: 'unsupported', url }
}

export function resultItemsToLightboxItems(
  items: readonly AugmentedResultItem[]
): LightboxItem[] {
  return items.map(resultItemToLightboxItem)
}
