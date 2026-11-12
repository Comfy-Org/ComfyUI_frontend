import type { AugmentedResultItem } from '@/utils/resultItem'
import { isImageResult, isTextResult, isVideoResult } from '@/utils/resultItem'

export const mediaTypes: Record<string, { iconClass: string }> = {
  '3d': {
    iconClass: 'icon-[lucide--box]'
  },
  audio: {
    iconClass: 'icon-[lucide--audio-lines]'
  },
  images: {
    iconClass: 'icon-[lucide--image]'
  },
  text: {
    iconClass: 'icon-[lucide--text]'
  },
  video: {
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
