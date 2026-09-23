import { t } from '@/i18n'

import type { AugmentedResultItem } from '@/utils/resultItem'
import { isImageResult, isTextResult, isVideoResult } from '@/utils/resultItem'

type StatItem = { content?: string; iconClass?: string }
export const mediaTypes: Record<string, StatItem> = {
  '3d': {
    content: t('sideToolbar.mediaAssets.filter3D'),
    iconClass: 'icon-[lucide--box]'
  },
  audio: {
    content: t('sideToolbar.mediaAssets.filterAudio'),
    iconClass: 'icon-[lucide--audio-lines]'
  },
  images: {
    content: t('sideToolbar.mediaAssets.filterImage'),
    iconClass: 'icon-[lucide--image]'
  },
  text: {
    content: t('sideToolbar.mediaAssets.filterText'),
    iconClass: 'icon-[lucide--text]'
  },
  video: {
    content: t('sideToolbar.mediaAssets.filterVideo'),
    iconClass: 'icon-[lucide--video]'
  }
}

export function getMediaType(output?: AugmentedResultItem) {
  if (!output) return ''
  if (isVideoResult(output)) return 'video'
  if (isImageResult(output)) return 'images'
  if (isTextResult(output)) return 'text'
  return output.mediaType
}
