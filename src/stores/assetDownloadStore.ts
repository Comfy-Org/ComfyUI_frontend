import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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
}

interface CompletedDownload {
  taskId: string
  modelType: string
  timestamp: number
}

const PROCESSED_TASK_CLEANUP_MS = 60000
const MAX_COMPLETED_DOWNLOADS = 10

export const useAssetDownloadStore = defineStore('assetDownload', () => {
  /** Map of task IDs to their download progress data */
  const downloads = ref<Map<string, AssetDownload>>(new Map())

  /** Map of task IDs to model types, used to track which model type to refresh after download completes */
  const pendingModelTypes = new Map<string, string>()

  /** Set of task IDs that have reached a terminal state (completed/failed), prevents duplicate processing */
  const processedTaskIds = new Set<string>()

  /** Reactive signal for completed downloads */
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

  /**
   * Associates a download task with its model type for later use when the download completes.
   * Intended for external callers (e.g., useUploadModelWizard) to register async downloads.
   */
  function trackDownload(taskId: string, modelType: string) {
    pendingModelTypes.set(taskId, modelType)
  }

  /**
   * Handles asset download WebSocket events. Updates download progress, manages toast notifications,
   * and tracks completed downloads. Prevents duplicate processing of terminal states (completed/failed).
   */
  function handleAssetDownload(e: CustomEvent<AssetDownloadWsMessage>) {
    const data = e.detail

    if (data.status === 'completed' || data.status === 'failed') {
      if (processedTaskIds.has(data.task_id)) return
      processedTaskIds.add(data.task_id)
    }

    const download: AssetDownload = {
      taskId: data.task_id,
      assetId: data.asset_id,
      assetName: data.asset_name,
      bytesTotal: data.bytes_total,
      bytesDownloaded: data.bytes_downloaded,
      progress: data.progress,
      status: data.status,
      error: data.error
    }

    downloads.value.set(data.task_id, download)

    if (data.status === 'completed') {
      const modelType = pendingModelTypes.get(data.task_id)
      if (modelType) {
        const newDownload: CompletedDownload = {
          taskId: data.task_id,
          modelType,
          timestamp: Date.now()
        }

        const updated = [...completedDownloads.value, newDownload]
        if (updated.length > MAX_COMPLETED_DOWNLOADS) {
          updated.shift()
        }
        completedDownloads.value = updated

        pendingModelTypes.delete(data.task_id)
      }
      setTimeout(
        () => processedTaskIds.delete(data.task_id),
        PROCESSED_TASK_CLEANUP_MS
      )
    } else if (data.status === 'failed') {
      pendingModelTypes.delete(data.task_id)
      setTimeout(
        () => processedTaskIds.delete(data.task_id),
        PROCESSED_TASK_CLEANUP_MS
      )
    }
  }

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
