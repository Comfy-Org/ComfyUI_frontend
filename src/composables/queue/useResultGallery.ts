import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import {
  findActiveIndex,
  getInspectionTargetsForTask
} from '@/services/jobOutputCache'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'
import {
  getInspectionTarget,
  getLightboxOutputs,
  getPreferredInspectionTarget
} from '@/utils/inspectionTarget'

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(getFilteredTasks: () => TaskItemImpl[]) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<ResultItemImpl[]>([])

  async function onViewItem(item: JobListItem) {
    const tasks = getFilteredTasks()
    if (!tasks.length) return

    const targetTask = item.taskRef
    const targets = targetTask
      ? await getInspectionTargetsForTask(targetTask)
      : null

    if (targetTask) {
      // Request was superseded by a newer one
      if (targets === null) return

      const targetOutputs = getLightboxOutputs(targets)
      if (!targetOutputs.length) return

      galleryItems.value = targetOutputs
      const preferredTarget = getPreferredInspectionTarget(
        targets.filter((target) => target.kind === 'lightbox')
      )
      galleryActiveIndex.value = findActiveIndex(
        targetOutputs,
        preferredTarget?.output.url
      )
      return
    }

    const items = tasks.flatMap((task) => {
      const preview = task.previewOutput
      if (!preview) return []

      const target = getInspectionTarget(preview)
      return target?.kind === 'lightbox' ? [target.output] : []
    })

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
