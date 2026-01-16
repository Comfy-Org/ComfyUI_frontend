import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'

/** Minimal preview item interface for gallery filtering. */
interface PreviewItem {
  url: string
  supportsPreview: boolean
}

/** Minimal task interface for gallery preview. */
interface TaskWithPreview<T extends PreviewItem = PreviewItem> {
  previewOutput?: T
}

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery<T extends PreviewItem>(
  getFilteredTasks: () => TaskWithPreview<T>[]
) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<T[]>([])

  const onViewItem = (item: JobListItem) => {
    const items: T[] = getFilteredTasks().flatMap((t) => {
      const preview = t.previewOutput
      return preview && preview.supportsPreview ? [preview] : []
    })

    if (!items.length) return

    galleryItems.value = items
    const activeUrl: string | undefined = item.taskRef?.previewOutput?.url
    const idx = activeUrl ? items.findIndex((o) => o.url === activeUrl) : 0
    galleryActiveIndex.value = idx >= 0 ? idx : 0
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
