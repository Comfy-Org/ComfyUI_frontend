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

export interface LightboxEntry<TSource> {
  readonly source: TSource
  readonly item: LightboxItem
}

export function toLightboxEntries<TSource>(
  sources: readonly TSource[],
  adapt: (source: TSource) => LightboxItem | undefined
): LightboxEntry<TSource>[] {
  return sources.flatMap((source) => {
    const item = adapt(source)
    return item ? [{ source, item }] : []
  })
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

export function resultLightboxEntries(
  items: readonly AugmentedResultItem[]
): LightboxEntry<AugmentedResultItem>[] {
  return toLightboxEntries(items, resultItemToLightboxItem)
}
