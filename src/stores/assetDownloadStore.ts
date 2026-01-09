import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { taskService } from '@/platform/tasks/services/taskService'
import type { AssetDownloadWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

export interface AssetDownload {
  taskId: string
  assetId: string
  assetName: string
  bytesTotal: number
  bytesDownloaded: number
  progress: number
  status: 'created' | 'running' | 'completed' | 'failed'
  error?: string
  lastUpdate: number
}

interface CompletedDownload {
  taskId: string
  modelType: string
  timestamp: number
}

const MAX_COMPLETED_DOWNLOADS = 10
const STALE_THRESHOLD_MS = 30_000
const POLL_INTERVAL_MS = 15_000

export const useAssetDownloadStore = defineStore('assetDownload', () => {
  const downloads = ref<Map<string, AssetDownload>>(new Map())
  const pendingModelTypes = new Map<string, string>()
  const completedDownloads = ref<CompletedDownload[]>([])

  const downloadList = computed(() => Array.from(downloads.value.values()))
  const activeDownloads = computed(() =>
    downloadList.value.filter(
      (d) => d.status === 'created' || d.status === 'running'
    )
  )
  const finishedDownloads = computed(() =>
    downloadList.value.filter(
      (d) => d.status === 'completed' || d.status === 'failed'
    )
  )
  const hasActiveDownloads = computed(() => activeDownloads.value.length > 0)
  const hasDownloads = computed(() => downloads.value.size > 0)

  function trackDownload(taskId: string, modelType: string) {
    pendingModelTypes.set(taskId, modelType)
  }

  function handleAssetDownload(e: CustomEvent<AssetDownloadWsMessage>) {
    const data = e.detail
    const existing = downloads.value.get(data.task_id)

    // Skip if already in terminal state
    if (existing?.status === 'completed' || existing?.status === 'failed') {
      return
    }

    const download: AssetDownload = {
      taskId: data.task_id,
      assetId: data.asset_id,
      assetName: data.asset_name,
      bytesTotal: data.bytes_total,
      bytesDownloaded: data.bytes_downloaded,
      progress: data.progress,
      status: data.status,
      error: data.error,
      lastUpdate: Date.now()
    }

    downloads.value.set(data.task_id, download)

    if (data.status === 'completed') {
      const modelType = pendingModelTypes.get(data.task_id)
      if (modelType) {
        const updated = [
          ...completedDownloads.value,
          { taskId: data.task_id, modelType, timestamp: Date.now() }
        ]
        if (updated.length > MAX_COMPLETED_DOWNLOADS) updated.shift()
        completedDownloads.value = updated
        pendingModelTypes.delete(data.task_id)
      }
    } else if (data.status === 'failed') {
      pendingModelTypes.delete(data.task_id)
    }
  }

  async function pollStaleDownloads() {
    const now = Date.now()

    for (const download of activeDownloads.value) {
      if (now - download.lastUpdate < STALE_THRESHOLD_MS) continue

      try {
        const task = await taskService.getTask(download.taskId)

        if (task.status === 'completed' || task.status === 'failed') {
          const result = task.result
          handleAssetDownload(
            new CustomEvent('asset_download', {
              detail: {
                task_id: download.taskId,
                asset_id: result?.asset_id ?? download.assetId,
                asset_name: result?.filename ?? download.assetName,
                bytes_total: result?.bytes_downloaded ?? download.bytesTotal,
                bytes_downloaded:
                  result?.bytes_downloaded ?? download.bytesTotal,
                progress: task.status === 'completed' ? 100 : download.progress,
                status: task.status,
                error: task.error_message ?? result?.error
              }
            })
          )
        }
      } catch {
        // Task not ready or not found
      }
    }
  }

  const { pause, resume } = useIntervalFn(
    () => void pollStaleDownloads(),
    POLL_INTERVAL_MS,
    { immediate: false }
  )

  watch(hasActiveDownloads, (hasActive) => {
    if (hasActive) resume()
    else pause()
  })

  api.addEventListener('asset_download', handleAssetDownload)

  function clearFinishedDownloads() {
    for (const download of finishedDownloads.value) {
      downloads.value.delete(download.taskId)
    }
  }

  return {
    activeDownloads,
    finishedDownloads,
    hasActiveDownloads,
    hasDownloads,
    downloadList,
    completedDownloads,
    trackDownload,
    clearFinishedDownloads
  }
})
