import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { openHdrViewer } from '@/services/hdrViewerService'
import { getOutputsForTask } from '@/services/jobOutputCache'
import type { TaskItemImpl } from '@/stores/queueStore'
import type { LightboxItem } from '@/types/lightboxItem'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'
import { resultLightboxEntries } from '@/utils/lightboxItem'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'

function isSameOutput(
  source: AugmentedResultItem,
  output: AugmentedResultItem
): boolean {
  return source === output || resultItemUrl(source) === resultItemUrl(output)
}

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

    if (targetOutputs === null && targetTask) return

    const previewOutput = targetTask?.previewOutput
    if (previewOutput && isHdrImageFilename(previewOutput.filename)) {
      openHdrViewer(resultItemUrl(previewOutput))
      return
    }

    const fromClickedJob = !!targetOutputs?.length
    const sources = (
      targetOutputs?.length
        ? targetOutputs
        : tasks.map((t) => t.previewOutput).filter((o) => !!o)
    ).filter((o) => !isHdrImageFilename(o.filename))
    const entries = resultLightboxEntries(sources)
    if (!entries.length) return

    const requestedIndex = previewOutput
      ? entries.findIndex(({ source }) => isSameOutput(source, previewOutput))
      : -1
    if (requestedIndex === -1 && previewOutput && !fromClickedJob) return

    galleryItems.value = entries.map(({ item: lightboxItem }) => lightboxItem)
    galleryActiveIndex.value = requestedIndex === -1 ? 0 : requestedIndex
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
