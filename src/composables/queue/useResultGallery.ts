import { ref, shallowRef, watch } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { openHdrViewer } from '@/services/hdrViewerService'
import { findActiveIndex, getOutputsForTask } from '@/services/jobOutputCache'
import type { TaskItemImpl } from '@/stores/queueStore'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(getFilteredTasks: () => TaskItemImpl[]) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<AugmentedResultItem[]>([])
  const galleryTaskId = shallowRef<string | null>(null)
  let openSequence = 0

  function resolveItems(
    targetTask: TaskItemImpl | undefined,
    tasks: TaskItemImpl[]
  ): AugmentedResultItem[] {
    return (
      targetTask
        ? [...targetTask.previewableOutputs]
        : tasks.map((t) => t.previewOutput).filter((o) => !!o)
    ).filter((o) => !isHdrImageFilename(o.filename))
  }

  function urlAt(
    items: readonly AugmentedResultItem[],
    index: number
  ): string | undefined {
    const item = items.at(index)
    return item ? resultItemUrl(item) : undefined
  }

  function isLiveRefreshCurrent(refreshId: number, taskId: string): boolean {
    return (
      refreshId === openSequence &&
      galleryTaskId.value === taskId &&
      galleryActiveIndex.value !== -1
    )
  }

  function hasHdrPreview(task: TaskItemImpl): boolean {
    return (
      task.previewOutput !== undefined &&
      isHdrImageFilename(task.previewOutput.filename)
    )
  }

  function nonHdrOutputs(
    outputs: readonly AugmentedResultItem[],
    fallback: readonly AugmentedResultItem[]
  ): AugmentedResultItem[] {
    return (outputs.length ? outputs : fallback).filter(
      (output) => !isHdrImageFilename(output.filename)
    )
  }

  watch(getFilteredTasks, (tasks) => {
    const taskId = galleryTaskId.value
    const index = galleryActiveIndex.value
    if (taskId === null || index === -1) return
    const targetTask = tasks.find((task) => task.jobId === taskId)
    if (!targetTask) return
    const activeUrl = urlAt(galleryItems.value, index)
    const rerun = resolveItems(targetTask, tasks)
    openSequence += 1
    if (rerun.length) {
      galleryItems.value = rerun
      galleryActiveIndex.value = findActiveIndex(rerun, activeUrl)
    }
    const refreshId = openSequence
    if (hasHdrPreview(targetTask)) return
    void getOutputsForTask(targetTask).then((targetOutputs) => {
      if (targetOutputs === null || !isLiveRefreshCurrent(refreshId, taskId))
        return
      const items = nonHdrOutputs(targetOutputs, rerun)
      if (!items.length) return
      const currentUrl =
        urlAt(galleryItems.value, galleryActiveIndex.value) ?? activeUrl
      galleryItems.value = items
      galleryActiveIndex.value = findActiveIndex(items, currentUrl)
    })
  })

  async function onViewItem(item: JobListItem) {
    const tasks = getFilteredTasks()
    if (!tasks.length) return
    const openId = ++openSequence

    const targetTask = item.taskRef
    const previewOutput = targetTask?.previewOutput
    if (previewOutput && isHdrImageFilename(previewOutput.filename)) {
      galleryItems.value = []
      galleryActiveIndex.value = -1
      galleryTaskId.value = targetTask.jobId
      openHdrViewer(resultItemUrl(previewOutput))
      return
    }

    const items = resolveItems(targetTask, tasks)
    if (!items.length) return

    const openedTaskId = targetTask?.jobId ?? null
    galleryItems.value = items
    galleryTaskId.value = openedTaskId
    galleryActiveIndex.value = findActiveIndex(
      items,
      previewOutput ? resultItemUrl(previewOutput) : undefined
    )
    if (!targetTask) return
    const targetOutputs = await getOutputsForTask(targetTask)
    if (openId !== openSequence) return
    if (galleryActiveIndex.value === -1) return
    if (galleryTaskId.value !== openedTaskId) return
    if (targetOutputs === null) return
    const refreshed = targetOutputs.length ? targetOutputs : items
    const activeUrl = urlAt(galleryItems.value, galleryActiveIndex.value)
    const filtered = refreshed.filter((o) => !isHdrImageFilename(o.filename))
    if (!filtered.length) return
    galleryItems.value = filtered
    galleryActiveIndex.value = findActiveIndex(filtered, activeUrl)
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
