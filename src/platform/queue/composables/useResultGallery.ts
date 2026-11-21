import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/platform/queue/presentation/queueDisplay'
import { openHdrViewer } from '@/services/hdrViewerService'
import {
  findActiveIndex,
  getOutputsForTask
} from '@/platform/queue/services/jobOutputCache'
import type { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import { isHdrImageFilename } from '@comfyorg/shared-frontend-utils/formatUtil'
import type { AugmentedResultItem } from '@comfyorg/api-client/results/resultItem'
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

    const previewOutput = targetTask?.previewOutput
    if (previewOutput && isHdrImageFilename(previewOutput.filename)) {
      openHdrViewer(resultItemUrl(previewOutput))
      return
    }

    const items = (
      targetOutputs?.length
        ? targetOutputs
        : tasks.map((t) => t.previewOutput).filter((o) => !!o)
    ).filter((o) => !isHdrImageFilename(o.filename))
    if (!items.length) return

    galleryItems.value = items
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
