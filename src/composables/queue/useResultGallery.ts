import { ref, shallowRef, watch } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { openHdrViewer } from '@/services/hdrViewerService'
import { findActiveIndex, getOutputsForTask } from '@/services/jobOutputCache'
import type { TaskItemImpl } from '@/stores/queueStore'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'

/** One resolve of the opened task's outputs, and the state it was requested for. */
interface GalleryRefresh {
  /** Task the refresh belongs to; a different one means the gallery was reopened. */
  taskId: string
  /** `openSequence` at request time; a newer open or queue update supersedes this. */
  sequenceId: number
  /** Items to keep if the task resolves no outputs (the list snapshot or the open). */
  fallbackItems: AugmentedResultItem[]
  /** Last-known active URL, used when the live list no longer has an item at its index. */
  fallbackUrl?: string
}

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

  function retainActiveItem(
    items: readonly AugmentedResultItem[],
    activeItem: AugmentedResultItem | undefined
  ): AugmentedResultItem[] {
    if (!activeItem) return [...items]
    const activeUrl = resultItemUrl(activeItem)
    return items.some((item) => resultItemUrl(item) === activeUrl)
      ? [...items]
      : [activeItem, ...items]
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

  /**
   * Adopts a resolved output set, unless the gallery moved on while it was in
   * flight. Shared by the live-refresh watcher and `onViewItem` so the staleness
   * guard and the re-anchor by URL cannot drift apart.
   */
  function adoptResolvedOutputs(
    outputs: readonly AugmentedResultItem[] | null,
    refresh: GalleryRefresh
  ): void {
    if (outputs === null) return
    if (refresh.sequenceId !== openSequence) return
    if (galleryTaskId.value !== refresh.taskId) return
    if (galleryActiveIndex.value === -1) return
    const items = nonHdrOutputs(outputs, refresh.fallbackItems)
    if (!items.length) return
    const currentUrl =
      urlAt(galleryItems.value, galleryActiveIndex.value) ?? refresh.fallbackUrl
    galleryItems.value = items
    galleryActiveIndex.value = findActiveIndex(items, currentUrl)
  }

  watch(getFilteredTasks, (tasks) => {
    const taskId = galleryTaskId.value
    const index = galleryActiveIndex.value
    if (taskId === null || index === -1) return
    const targetTask = tasks.find((task) => task.jobId === taskId)
    if (!targetTask) return
    const activeItem = galleryItems.value.at(index)
    const activeUrl = activeItem ? resultItemUrl(activeItem) : undefined
    const rerun = retainActiveItem(resolveItems(targetTask, tasks), activeItem)
    const sequenceId = ++openSequence
    // A list snapshot that would lose items the gallery already shows is not
    // adopted: only the output refresh may shrink it.
    if (rerun.length >= galleryItems.value.length) {
      galleryItems.value = rerun
      galleryActiveIndex.value = findActiveIndex(rerun, activeUrl)
    }
    if (hasHdrPreview(targetTask)) return
    const refresh: GalleryRefresh = {
      taskId,
      sequenceId,
      fallbackItems: rerun,
      fallbackUrl: activeUrl
    }
    void getOutputsForTask(targetTask).then((targetOutputs) =>
      adoptResolvedOutputs(targetOutputs, refresh)
    )
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
    adoptResolvedOutputs(targetOutputs, {
      taskId: targetTask.jobId,
      sequenceId: openId,
      fallbackItems: items
    })
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
