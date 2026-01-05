import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useEventListener } from '@vueuse/core'

import { st } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { AssetDownloadWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

interface AssetDownload {
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

const PROGRESS_TOAST_INTERVAL_MS = 5000
const PROCESSED_TASK_CLEANUP_MS = 60000
const MAX_COMPLETED_DOWNLOADS = 10

export const useAssetDownloadStore = defineStore('assetDownload', () => {
  const toastStore = useToastStore()
  const activeDownloads = ref<Map<string, AssetDownload>>(new Map())
  const pendingModelTypes = new Map<string, string>()
  const lastToastTime = new Map<string, number>()
  const processedTaskIds = new Set<string>()

  // Reactive signal for completed downloads
  const completedDownloads = ref<CompletedDownload[]>([])

  const hasActiveDownloads = computed(() => activeDownloads.value.size > 0)
  const downloadList = computed(() =>
    Array.from(activeDownloads.value.values())
  )

  function trackDownload(taskId: string, modelType: string) {
    pendingModelTypes.set(taskId, modelType)
  }

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

    if (data.status === 'completed') {
      activeDownloads.value.delete(data.task_id)
      lastToastTime.delete(data.task_id)
      const modelType = pendingModelTypes.get(data.task_id)
      if (modelType) {
        // Emit completed download signal for other stores to react to
        const newDownload: CompletedDownload = {
          taskId: data.task_id,
          modelType,
          timestamp: Date.now()
        }

        // Keep only the last MAX_COMPLETED_DOWNLOADS items (FIFO)
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
      toastStore.add({
        severity: 'success',
        summary: st('assetBrowser.download.complete', 'Download complete'),
        detail: data.asset_name,
        life: 5000
      })
    } else if (data.status === 'failed') {
      activeDownloads.value.delete(data.task_id)
      lastToastTime.delete(data.task_id)
      pendingModelTypes.delete(data.task_id)
      setTimeout(
        () => processedTaskIds.delete(data.task_id),
        PROCESSED_TASK_CLEANUP_MS
      )
      toastStore.add({
        severity: 'error',
        summary: st('assetBrowser.download.failed', 'Download failed'),
        detail: data.error || data.asset_name,
        life: 8000
      })
    } else {
      activeDownloads.value.set(data.task_id, download)

      const now = Date.now()
      const lastTime = lastToastTime.get(data.task_id) ?? 0
      const shouldShowToast = now - lastTime >= PROGRESS_TOAST_INTERVAL_MS

      if (shouldShowToast) {
        lastToastTime.set(data.task_id, now)
        const progressPercent = Math.round(data.progress * 100)
        toastStore.add({
          severity: 'info',
          summary: st('assetBrowser.download.inProgress', 'Downloading...'),
          detail: `${data.asset_name} (${progressPercent}%)`,
          life: PROGRESS_TOAST_INTERVAL_MS,
          closable: true
        })
      }
    }
  }

  let stopListener: (() => void) | undefined

  function setup() {
    stopListener = useEventListener(api, 'asset_download', handleAssetDownload)
  }

  function teardown() {
    stopListener?.()
    stopListener = undefined
  }

  return {
    activeDownloads,
    hasActiveDownloads,
    downloadList,
    completedDownloads,
    trackDownload,
    setup,
    teardown
  }
})
