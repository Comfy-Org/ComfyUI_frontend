import { t } from '@/i18n'

import type { ResultItemImpl } from '@/stores/queueStore'

type StatItem = { content?: string; iconClass?: string }
export const mediaTypes: Record<string, StatItem> = {
  '3d': {
    content: t('sideToolbar.mediaAssets.filter3D'),
    iconClass: 'icon-[lucide--box]'
  },
  image_compare: {
    content: t('sideToolbar.mediaAssets.filterImageCompare'),
    iconClass: 'icon-[lucide--columns-2]'
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

export function getMediaType(output?: ResultItemImpl) {
  if (!output) return ''
  if (output.isImageCompare) return 'image_compare'
  if (output.isVideo) return 'video'
  if (output.isImage) return 'images'
  return output.mediaType
}
