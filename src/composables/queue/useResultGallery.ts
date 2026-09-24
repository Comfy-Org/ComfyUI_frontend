import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { getOutputsForTask } from '@/services/jobOutputCache'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { LightboxItem } from '@/types/lightboxItem'
import {
  findLightboxIndexByUrl,
  resultItemsToLightboxItems
} from '@/utils/lightboxItem'
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
    const showingTargetOutputs = Boolean(targetOutputs?.length)
    const items = showingTargetOutputs
      ? targetOutputs!
      : tasks.map((t) => t.previewOutput).filter((o) => !!o)

    if (!items.length) return

    const lightboxItems = resultItemsToLightboxItems(items)
    if (!lightboxItems.length) return

    const previewOutput = item.taskRef?.previewOutput
    const requestedIndex = previewOutput
      ? findLightboxIndexByUrl(lightboxItems, resultItemUrl(previewOutput))
      : undefined

    // Falling back to the first item is only right within the clicked job;
    // across jobs it would open a different job's media.
    if (
      requestedIndex === undefined &&
      previewOutput &&
      !showingTargetOutputs
    ) {
      return
    }

    galleryItems.value = lightboxItems
    galleryActiveIndex.value = requestedIndex ?? 0
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
