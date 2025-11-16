import { ref, shallowRef } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import type { ResultItemImpl } from '@/stores/queueStore'

type FetchApi = (url: string) => Promise<Response>

/**
 * Minimal interface for tasks used by the result gallery.
 * This allows the gallery to work with any object that provides these properties,
 * without coupling to the full TaskItemImpl class.
 */
interface GalleryTask {
  readonly promptId: string
  readonly outputsCount?: number
  readonly flatOutputs: readonly ResultItemImpl[]
  readonly previewOutput?: ResultItemImpl
  loadFullOutputs(fetchApi: FetchApi): Promise<GalleryTask>
}

const getPreviewableOutputs = (outputs?: readonly ResultItemImpl[]) =>
  outputs?.filter((o) => o.supportsPreview) ?? []

const findActiveIndex = (items: ResultItemImpl[], url?: string): number => {
  if (!url) return 0
  const idx = items.findIndex((o) => o.url === url)
  return idx >= 0 ? idx : 0
}

/**
 * Manages result gallery state and activation for queue items.
 */
export function useResultGallery(
  getFilteredTasks: () => GalleryTask[],
  fetchApi?: FetchApi
) {
  const galleryActiveIndex = ref(-1)
  const galleryItems = shallowRef<ResultItemImpl[]>([])

  const loadedTasksCache = new Map<string, GalleryTask>()
  let currentRequestId = 0

  const getOutputsForTask = async (
    task: GalleryTask
  ): Promise<ResultItemImpl[]> => {
    const outputsCount = task.outputsCount ?? 0
    const needsLazyLoad = outputsCount > 1 && fetchApi

    if (!needsLazyLoad) {
      return getPreviewableOutputs(task.flatOutputs)
    }

    const cacheKey = String(task.promptId)
    const cached = loadedTasksCache.get(cacheKey)
    if (cached) {
      return getPreviewableOutputs(cached.flatOutputs)
    }

    const loadedTask = await task.loadFullOutputs(fetchApi)
    loadedTasksCache.set(cacheKey, loadedTask)
    return getPreviewableOutputs(loadedTask.flatOutputs)
  }

  const onViewItem = async (item: JobListItem) => {
    const tasks = getFilteredTasks()
    if (!tasks.length) return

    const requestId = ++currentRequestId

    const targetTask = item.taskRef as GalleryTask | undefined
    let targetOutputs: ResultItemImpl[] = []

    if (targetTask) {
      targetOutputs = await getOutputsForTask(targetTask)
    }

    // Abort if a newer request was made while loading
    if (requestId !== currentRequestId) return

    const activeUrl = item.taskRef?.previewOutput?.url

    if (targetOutputs.length > 0) {
      galleryItems.value = targetOutputs
      galleryActiveIndex.value = findActiveIndex(targetOutputs, activeUrl)
    } else {
      const items = tasks.flatMap((t) => {
        const preview = t.previewOutput
        return preview?.supportsPreview ? [preview] : []
      })

      if (!items.length) return

      galleryItems.value = items
      galleryActiveIndex.value = findActiveIndex(items, activeUrl)
    }
  }

  return {
    galleryActiveIndex,
    galleryItems,
    onViewItem
  }
}
