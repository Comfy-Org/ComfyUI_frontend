import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/queue/composables/useJobList'
import type { ResultItemImpl } from '@/queue/stores/queueStore'

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(getFilteredTasks: () => any[]) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<ResultItemImpl[]>([])

  const onViewItem = (item: JobListItem) => {
    const items: ResultItemImpl[] = getFilteredTasks().flatMap((t: any) => {
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
