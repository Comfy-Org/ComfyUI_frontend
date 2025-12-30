import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobOutputStore } from '@/stores/jobOutputStore'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

type FetchApi = (url: string) => Promise<Response>

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(
  getFilteredTasks: () => TaskItemImpl[],
  fetchApi?: FetchApi
) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<ResultItemImpl[]>([])

  const jobOutputStore = useJobOutputStore()
  let currentRequestId = 0

  async function onViewItem(item: JobListItem) {
    const tasks = getFilteredTasks()
    if (!tasks.length) return

    const requestId = ++currentRequestId

    const targetTask = item.taskRef
    let targetOutputs: ResultItemImpl[] = []

    if (targetTask) {
      targetOutputs = await jobOutputStore.getOutputsForTask(
        targetTask,
        fetchApi
      )
    }

    // Abort if a newer request was made while loading
    if (requestId !== currentRequestId) return

    const activeUrl = item.taskRef?.previewOutput?.url

    if (targetOutputs.length > 0) {
      galleryItems.value = targetOutputs
      galleryActiveIndex.value = jobOutputStore.findActiveIndex(
        targetOutputs,
        activeUrl
      )
    } else {
      const items = jobOutputStore.getPreviewableOutputs(
        tasks.flatMap((t) => (t.previewOutput ? [t.previewOutput] : []))
      )

      if (!items.length) return

      galleryItems.value = items
      galleryActiveIndex.value = jobOutputStore.findActiveIndex(
        items,
        activeUrl
      )
    }
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
