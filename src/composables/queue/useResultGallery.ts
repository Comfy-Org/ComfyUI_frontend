import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { getOutputsForTask } from '@/services/jobOutputCache'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { LightboxItem } from '@/types/lightboxItem'
import { resultLightboxEntries } from '@/utils/lightboxItem'
import { resultItemUrl } from '@/utils/resultItemUrl'

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(getFilteredTasks: () => TaskItemImpl[]) {
  const galleryActiveIndex = ref<number | null>(null)
  const galleryItems = shallowRef<LightboxItem[]>([])

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
    const { entries, fromClickedJob } = targetOutputs?.length
      ? { entries: resultLightboxEntries(targetOutputs), fromClickedJob: true }
      : {
          entries: resultLightboxEntries(
            tasks.map((t) => t.previewOutput).filter((o) => !!o)
          ),
          fromClickedJob: false
        }

    if (!entries.length) return

    const previewOutput = item.taskRef?.previewOutput
    const previewUrl = previewOutput ? resultItemUrl(previewOutput) : undefined
    const requestedIndex = previewUrl
      ? entries.findIndex(({ source }) => resultItemUrl(source) === previewUrl)
      : -1

    // Falling back to the first item is only right within the clicked job;
    // across jobs it would open a different job's media.
    if (requestedIndex === -1 && previewUrl && !fromClickedJob) return

    galleryItems.value = entries.map(({ item: lightboxItem }) => lightboxItem)
    galleryActiveIndex.value = requestedIndex === -1 ? 0 : requestedIndex
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
