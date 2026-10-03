import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type {
  TaskId,
  TaskResponse,
  TaskResult,
  TaskStatus
} from '@/platform/tasks/services/taskService'
import { taskService } from '@/platform/tasks/services/taskService'
import type { AssetDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'
import { api } from '@/scripts/api'

export type AssetDownloadStatus = TaskStatus | 'cancellation_pending'

const activeStatuses = new Set<AssetDownloadStatus>(['created', 'running'])
const finishedStatuses = new Set<AssetDownloadStatus>([
  'completed',
  'failed',
  'cancelled'
])
const recheckableStatuses = new Set<AssetDownloadStatus>([
  'created',
  'running',
  'failed',
  'cancellation_pending'
])
const reconcilableTaskStatuses = new Set<TaskStatus>([
  'completed',
  'failed',
  'cancelled'
])

function isDownloadActive(status: AssetDownloadStatus) {
  return activeStatuses.has(status)
}

export function isDownloadCancelled(status: AssetDownloadStatus) {
  return status === 'cancellation_pending' || status === 'cancelled'
}

function isDownloadFinished(status: AssetDownloadStatus) {
  return finishedStatuses.has(status)
}

function isDownloadRecheckable(download: AssetDownload) {
  return (
    recheckableStatuses.has(download.status) ||
    download.needsCancellationReconciliation === true
  )
}

export interface AssetDownload {
  taskId: TaskId
  assetName: string
  bytesTotal: number
  bytesDownloaded: number
  progress: number
  status: AssetDownloadStatus
  lastUpdate: number
  assetId?: string
  error?: string
  modelType?: string
  acknowledged?: boolean
  needsCancellationReconciliation?: boolean
}

interface CompletedDownload {
  taskId: TaskId
  modelType: string
  timestamp: number
}
const STALE_THRESHOLD_MS = 10_000
const POLL_INTERVAL_MS = 10_000
const CANCELLATION_PENDING_RETENTION_MS = 5 * 60_000

function generateDownloadTrackingPlaceholder(
  taskId: TaskId,
  modelType: string,
  assetName: string
): AssetDownload {
  return {
    taskId,
    modelType,
    assetName,
    bytesTotal: 0,
    bytesDownloaded: 0,
    progress: 0,
    status: 'created',
    lastUpdate: Date.now()
  }
}

function shouldIgnoreDownloadUpdate(
  current: AssetDownload | undefined,
  nextStatus: TaskStatus
): boolean {
  const currentStatus = current?.status
  if (currentStatus === 'completed') return true
  if (currentStatus === 'cancelled') {
    return current?.needsCancellationReconciliation
      ? !reconcilableTaskStatuses.has(nextStatus)
      : nextStatus !== 'completed'
  }
  if (currentStatus === 'cancellation_pending') {
    return !reconcilableTaskStatuses.has(nextStatus)
  }
  return false
}

function createReconciledDownloadMessage(
  download: AssetDownload,
  task: TaskResponse
): AssetDownloadWsMessage {
  const result = task.result
  return {
    task_id: download.taskId,
    asset_id: result?.asset_id ?? download.assetId,
    asset_name: result?.filename ?? download.assetName,
    bytes_total: download.bytesTotal,
    bytes_downloaded: result?.bytes_downloaded ?? download.bytesDownloaded,
    progress: task.status === 'completed' ? 100 : download.progress,
    status: task.status,
    error: task.error_message ?? result?.error
  }
}

export const useAssetDownloadStore = defineStore('assetDownload', () => {
  const downloads = ref<Map<string, AssetDownload>>(new Map())
  const cancellingTaskIds = ref(new Set<TaskId>())
  const lastCompletedDownload = ref<CompletedDownload | null>(null)

  const downloadList = computed(() => Array.from(downloads.value.values()))
  const activeDownloads = computed(() =>
    downloadList.value.filter((download) => isDownloadActive(download.status))
  )
  const finishedDownloads = computed(() =>
    downloadList.value.filter((download) => isDownloadFinished(download.status))
  )
  const unacknowledgedDownloads = computed(() =>
    finishedDownloads.value.filter(
      (d) => d.status === 'completed' && d.assetId && !d.acknowledged
    )
  )
  const sessionDownloadCount = computed(
    () => unacknowledgedDownloads.value.length
  )
  const hasActiveDownloads = computed(() => activeDownloads.value.length > 0)
  const hasDownloads = computed(() => downloads.value.size > 0)
  const hasPendingCancellation = computed(() =>
    downloadList.value.some(
      (download) => download.status === 'cancellation_pending'
    )
  )
  const recheckableDownloads = computed(() =>
    downloadList.value.filter(isDownloadRecheckable)
  )
  const hasRecheckableDownloads = computed(
    () => recheckableDownloads.value.length > 0
  )

  function isDownloadedThisSession(assetId: string): boolean {
    return unacknowledgedDownloads.value.some((d) => d.assetId === assetId)
  }

  function acknowledgeAsset(assetId: string) {
    for (const download of downloads.value.values()) {
      if (download.assetId === assetId) {
        download.acknowledged = true
      }
    }
  }

  function trackDownload(taskId: TaskId, modelType: string, assetName: string) {
    if (downloads.value.has(taskId)) return

    downloads.value.set(
      taskId,
      generateDownloadTrackingPlaceholder(taskId, modelType, assetName)
    )
  }

  function handleAssetDownload(e: CustomEvent<AssetDownloadWsMessage>) {
    const data = e.detail
    const existing = downloads.value.get(data.task_id)

    if (shouldIgnoreDownloadUpdate(existing, data.status)) return

    const download: AssetDownload = {
      taskId: data.task_id,
      assetId: data.asset_id,
      assetName: data.asset_name,
      bytesTotal: data.bytes_total,
      bytesDownloaded: data.bytes_downloaded,
      progress: data.progress,
      status: data.status,
      error: data.error,
      lastUpdate: Date.now(),
      modelType: existing?.modelType
    }

    downloads.value.set(data.task_id, download)

    if (data.status === 'completed' && download.modelType) {
      lastCompletedDownload.value = {
        taskId: data.task_id,
        modelType: download.modelType,
        timestamp: Date.now()
      }
    }
  }

  async function pollStaleDownloads() {
    const now = Date.now()
    const staleDownloads = recheckableDownloads.value.filter(
      (d) => now - d.lastUpdate >= STALE_THRESHOLD_MS
    )

    if (staleDownloads.length === 0) return

    async function pollSingleDownload(download: AssetDownload) {
      if (
        download.status === 'cancellation_pending' &&
        Date.now() - download.lastUpdate >= CANCELLATION_PENDING_RETENTION_MS
      ) {
        download.status = 'cancelled'
        download.needsCancellationReconciliation = true
      }

      const result = await taskService.getTask(download.taskId)
      if (!result.ok) return
      if (downloads.value.get(download.taskId) !== download) return

      const task = result.value
      if (!reconcilableTaskStatuses.has(task.status)) return
      if (task.status === 'cancelled') {
        download.status = 'cancelled'
        download.needsCancellationReconciliation = false
        download.lastUpdate = Date.now()
        return
      }
      handleAssetDownload(
        new CustomEvent('asset_download', {
          detail: createReconciledDownloadMessage(download, task)
        })
      )
    }

    await Promise.all(staleDownloads.map(pollSingleDownload))
  }

  const { pause, resume } = useIntervalFn(
    () => void pollStaleDownloads(),
    POLL_INTERVAL_MS,
    { immediate: false }
  )

  watch(
    hasRecheckableDownloads,
    (hasRecheckable) => {
      if (hasRecheckable) resume()
      else pause()
    },
    { immediate: true }
  )

  api.addEventListener('asset_download', handleAssetDownload)

  function clearFinishedDownloads() {
    for (const download of finishedDownloads.value) {
      downloads.value.delete(download.taskId)
    }
  }

  async function cancelDownload(taskId: TaskId): Promise<TaskResult<boolean>> {
    const download = downloads.value.get(taskId)
    if (
      cancellingTaskIds.value.has(taskId) ||
      !download ||
      !activeStatuses.has(download.status)
    ) {
      return { ok: true, value: false }
    }
    cancellingTaskIds.value.add(taskId)
    try {
      const result = await taskService.cancelTask(taskId)
      if (!result.ok) return result

      const current = downloads.value.get(taskId)
      if (!result.value || !current || finishedStatuses.has(current.status)) {
        return result
      }
      current.status = 'cancellation_pending'
      current.needsCancellationReconciliation = false
      current.lastUpdate = Date.now()
      return result
    } finally {
      cancellingTaskIds.value.delete(taskId)
    }
  }

  return {
    activeDownloads,
    finishedDownloads,
    hasActiveDownloads,
    hasDownloads,
    hasPendingCancellation,
    downloadList,
    lastCompletedDownload,
    sessionDownloadCount,
    trackDownload,
    cancellingTaskIds,
    cancelDownload,
    clearFinishedDownloads,
    isDownloadedThisSession,
    acknowledgeAsset
  }
})
