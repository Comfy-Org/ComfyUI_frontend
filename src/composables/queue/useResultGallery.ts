import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { findActiveIndex, getOutputsForTask } from '@/services/jobOutputCache'
import { useDialogStore } from '@/stores/dialogStore'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

const Load3dViewerContent = () =>
  import('@/components/load3d/Load3dViewerContent.vue')

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(getFilteredTasks: () => TaskItemImpl[]) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<ResultItemImpl[]>([])
  const dialogStore = useDialogStore()

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
    if (previewOutput?.is3D) {
      dialogStore.showDialog({
        key: 'queue-asset-3d-viewer',
        title: previewOutput.filename,
        component: Load3dViewerContent,
        props: {
          modelUrl: previewOutput.url
        },
        dialogComponentProps: {
          style: 'width: 80vw; height: 80vh;',
          maximizable: true
        }
      })
      return
    }

    // Use target's outputs if available, otherwise fall back to all previews
    const items = targetOutputs?.length
      ? targetOutputs
      : tasks
          .map((t) => t.previewOutput)
          .filter((o): o is ResultItemImpl => !!o)

    if (!items.length) return

    galleryItems.value = items
    galleryActiveIndex.value = findActiveIndex(
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
