import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { findActiveIndex, getOutputsForTask } from '@/services/jobOutputCache'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(getFilteredTasks: () => TaskItemImpl[]) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<AugmentedResultItem[]>([])

  async function onViewItem(item: JobListItem) {
    const tasks = getFilteredTasks()
    if (!tasks.length) return

    const targetTask = item.taskRef
    const targetOutputs = targetTask
      ? await getOutputsForTask(targetTask)
      : null

    // Request was superseded by a newer one
    if (targetOutputs === null && targetTask) return

    // Use target's outputs if available, otherwise fall back to all previews
    const items = targetOutputs?.length
      ? targetOutputs
      : tasks
          .map((t) => t.previewOutput)
          .filter((o): o is AugmentedResultItem => !!o)

    if (!items.length) return

    galleryItems.value = items
    const previewOutput = item.taskRef?.previewOutput
    galleryActiveIndex.value = findActiveIndex(
      items,
      previewOutput ? resultItemUrl(previewOutput) : undefined
    )
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
