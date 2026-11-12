import type { JobListItem } from '@comfyorg/api-client/jobTypes'
import { reportError } from '@comfyorg/telemetry/reportError'
import { createSharedComposable, useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { mapTaskOutputToAssetItem } from '@/platform/assets/composables/media/assetMappers'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { api } from '@/scripts/api'
import { TaskItemImpl } from '@/stores/queueStore'
import { WrappedList } from '@/utils/pagedList'
import type { PagedList } from '@/utils/pagedList'

function mapHistoryToAssets(historyItems: JobListItem[]): AssetItem[] {
  const assetItems: AssetItem[] = []

  for (const job of historyItems) {
    if (job.status !== 'completed' || !job.preview_output) continue

    const task = new TaskItemImpl(job)
    if (!task.previewOutput) continue

    const assetItem = mapTaskOutputToAssetItem(task, task.previewOutput)
    assetItem.user_metadata = {
      ...assetItem.user_metadata,
      outputCount:
        task.previewableOutputsCount ??
        task.outputsCount ??
        task.previewableOutputs.length,
      allOutputs: task.previewableOutputs
    }
    assetItems.push(assetItem)
  }

  return assetItems.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

const BATCH_SIZE = 200
const MAX_HISTORY_ITEMS = 1000

export const useJobOutputHistory = createSharedComposable(
  (): [PagedList<AssetItem>, PagedList<AssetItem>] => {
    const historyOffset = ref(0)
    const hasMoreHistory = ref(true)
    const isLoadingMore = ref(false)
    const historyAssets = ref<AssetItem[]>([])
    const resolvedAssetsCache = ref<Partial<Record<string, AssetItem[]>>>({})

    const fetchHistoryAssets = async (
      loadMore = false
    ): Promise<AssetItem[]> => {
      const offset = loadMore ? historyOffset.value : 0
      const history = await api.getHistory(BATCH_SIZE, { offset })
      const newAssets = mapHistoryToAssets(history)
      const items = loadMore ? [...historyAssets.value] : []
      const loadedIds = new Set(items.map(({ id }) => id))

      for (const asset of newAssets) {
        if (loadedIds.has(asset.id)) continue
        loadedIds.add(asset.id)

        const assetTime = new Date(asset.created_at).getTime()
        const insertIndex = items.findIndex(
          (item) => new Date(item.created_at).getTime() < assetTime
        )
        if (insertIndex === -1) items.push(asset)
        else items.splice(insertIndex, 0, asset)
      }

      historyOffset.value = offset + BATCH_SIZE
      hasMoreHistory.value = history.length === BATCH_SIZE
      return items.slice(0, MAX_HISTORY_ITEMS)
    }

    const historyLoading = ref(false)
    const historyError = ref<unknown>(null)
    let historyQueue = Promise.resolve()
    let refreshPromise: Promise<void> | undefined
    let loadMorePromise: Promise<boolean> | undefined

    const doUpdateHistory = async () => {
      historyLoading.value = true
      historyError.value = null
      try {
        const items = await fetchHistoryAssets(false)
        resolvedAssetsCache.value = {}
        historyAssets.value = items
      } catch (err) {
        reportError(err, {
          errorType: 'failure_loading_job_history',
          surface: 'assets'
        })
        historyError.value = err
      } finally {
        historyLoading.value = false
      }
    }

    const updateHistory = () => {
      if (!refreshPromise) {
        refreshPromise = historyQueue.then(doUpdateHistory).finally(() => {
          refreshPromise = undefined
        })
        historyQueue = refreshPromise
      }
      return refreshPromise
    }

    const doLoadMoreHistory = async () => {
      isLoadingMore.value = true
      historyError.value = null
      try {
        historyAssets.value = await fetchHistoryAssets(true)
        return true
      } catch (err) {
        reportError(err, {
          errorType: 'failure_loading_job_history',
          surface: 'assets'
        })
        historyError.value = err
        return false
      } finally {
        isLoadingMore.value = false
      }
    }

    const loadMoreHistory = () => {
      if (!loadMorePromise) {
        const operation = historyQueue.then(() =>
          hasMoreHistory.value ? doLoadMoreHistory() : false
        )
        loadMorePromise = operation.finally(() => {
          loadMorePromise = undefined
        })
        historyQueue = operation.then(() => undefined)
      }
      return loadMorePromise
    }

    const outputAssets = {
      hasMore: hasMoreHistory,
      invalidate: updateHistory,
      isLoading: computed(() => historyLoading.value || isLoadingMore.value),
      items: historyAssets,
      loadMore: loadMoreHistory,
      loadNew: updateHistory
    }
    watch(
      historyAssets,
      (items) => {
        const currentAssetsCache = resolvedAssetsCache.value
        const currentIds = new Set(items.map(({ id }) => id))
        for (const jobId of Object.keys(currentAssetsCache)) {
          if (!currentIds.has(jobId)) delete currentAssetsCache[jobId]
        }
        for (const asset of items) {
          const metadata = getOutputAssetMetadata(asset.user_metadata)
          const jobId = metadata?.jobId
          if (!jobId || currentAssetsCache[jobId]) continue
          void resolveOutputAssetItems(metadata, {
            createdAt: asset.created_at
          }).then((assets) => {
            if (historyAssets.value.includes(asset)) {
              currentAssetsCache[jobId] = assets
            }
          })
        }
      },
      { immediate: true }
    )
    const flatOutputs = new WrappedList(outputAssets, (items) =>
      items.flatMap((asset) => {
        const jobId = getOutputAssetMetadata(asset.user_metadata)?.jobId
        if (!jobId) return [asset]
        return resolvedAssetsCache.value[jobId] ?? [asset]
      })
    )
    useEventListener(api, 'execution_success', updateHistory)
    void loadMoreHistory()
    return [outputAssets, flatOutputs]
  }
)
