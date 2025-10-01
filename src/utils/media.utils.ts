/**
 * Media utility functions for Asset Library
 */
import type { MediaKind } from '@/types/media.types'

/**
 * Get icon name for a given media kind
 */
export function kindToIcon(kind: MediaKind): string {
  const iconMap: Record<MediaKind, string> = {
    video: 'pi pi-video',
    webm: 'pi pi-video',
    webp: 'pi pi-image',
    gif: 'pi pi-images',
    audio: 'pi pi-volume-up',
    image: 'pi pi-image',
    pose: 'pi pi-user',
    text: 'pi pi-file-edit',
    other: 'pi pi-file'
  }

  return iconMap[kind] || 'pi pi-file'
}
