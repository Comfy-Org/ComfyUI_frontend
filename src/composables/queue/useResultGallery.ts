import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobOutputStore } from '@/stores/jobOutputStore'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(getFilteredTasks: () => TaskItemImpl[]) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<ResultItemImpl[]>([])

  const jobOutputStore = useJobOutputStore()

  async function onViewItem(item: JobListItem) {
    const tasks = getFilteredTasks()
    if (!tasks.length) return

    const targetTask = item.taskRef
    const targetOutputs = targetTask
      ? await jobOutputStore.getOutputsForTask(targetTask)
      : null

    // Request was superseded by a newer one
    if (targetOutputs === null && targetTask) return

    // Use target's outputs if available, otherwise fall back to all previews
    const items = targetOutputs?.length
      ? targetOutputs
      : tasks
          .map((t) => t.previewOutput)
          .filter((o): o is ResultItemImpl => !!o)

    if (!items.length) return

    galleryItems.value = items
    galleryActiveIndex.value = jobOutputStore.findActiveIndex(
      items,
      item.taskRef?.previewOutput?.url
    )
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
