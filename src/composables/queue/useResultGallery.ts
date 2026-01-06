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
    let targetOutputs: ResultItemImpl[] | null = null

    if (targetTask) {
      targetOutputs = await jobOutputStore.getOutputsForTask(targetTask)
      // Store returns null if request was superseded
      if (targetOutputs === null) return
    }

    const activeUrl = item.taskRef?.previewOutput?.url

    if (targetOutputs && targetOutputs.length > 0) {
      galleryItems.value = targetOutputs
      galleryActiveIndex.value = jobOutputStore.findActiveIndex(
        targetOutputs,
        activeUrl
      )
    } else {
      // Collect preview outputs from all tasks (already previewable by definition)
      const items = tasks
        .map((t) => t.previewOutput)
        .filter((o): o is ResultItemImpl => o !== undefined)

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
