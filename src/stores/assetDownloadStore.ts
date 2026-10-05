import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type {
  DownloadFileResult,
  TaskId,
  TaskResponse,
  TaskResult,
  TaskStatus
} from '@/platform/tasks/services/taskService'
import {
  TaskNotFoundError,
  parseDownloadFileResult,
  taskService
} from '@/platform/tasks/services/taskService'
import type { AssetDownloadWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { t } from '@/i18n'

export type AssetDownloadStatus =
  | TaskStatus
  | 'cancellation_pending'
  | 'cancellation_unconfirmed'

const activeStatuses = new Set<AssetDownloadStatus>(['created', 'running'])
const finishedStatuses = new Set<AssetDownloadStatus>([
  'completed',
  'failed',
  'cancelled',
  'cancellation_unconfirmed'
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
const wireTaskStatuses = new Set<string>([
  'created',
  'running',
  'completed',
  'failed',
  'cancelled'
])

function isDownloadActive(status: AssetDownloadStatus) {
  return activeStatuses.has(status)
}

export function isDownloadCancelled(status: AssetDownloadStatus) {
  return (
    status === 'cancellation_pending' ||
    status === 'cancellation_unconfirmed' ||
    status === 'cancelled'
  )
}

function isDownloadFinished(status: AssetDownloadStatus) {
  return finishedStatuses.has(status)
}

function isDownloadRecheckable(status: AssetDownloadStatus) {
  return recheckableStatuses.has(status)
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
  /**
   * Reconciliation attempts made since this download entered
   * `cancellation_pending` that did not produce a terminal task status.
   */
  cancellationReconcileAttempts?: number
}

interface CompletedDownload {
  taskId: TaskId
  modelType: string
  timestamp: number
}
const STALE_THRESHOLD_MS = 10_000
const POLL_INTERVAL_MS = 10_000
/**
 * `cancellation_pending` is not a finished status, so the dialog withholds its
 * Close control while a download is in it. Bounding how long we wait for the
 * backend to confirm keeps a backend that accepts the DELETE and then never
 * reports a terminal status from pinning the toast open until a page reload.
 */
const MAX_CANCELLATION_RECONCILE_ATTEMPTS = 6
const MAX_TASK_NOT_FOUND_ATTEMPTS = 2
const MAX_DISMISSED_DOWNLOADS = 256

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
  currentStatus: AssetDownloadStatus | undefined,
  nextStatus: TaskStatus
): boolean {
  if (currentStatus === 'completed') return true
  if (currentStatus === 'cancelled') return nextStatus !== 'completed'
  if (currentStatus === 'cancellation_pending') {
    return !reconcilableTaskStatuses.has(nextStatus)
  }
  if (currentStatus === 'cancellation_unconfirmed') {
    return activeStatuses.has(nextStatus)
  }
  return false
}

/**
 * Settle a cancellation the backend will never confirm. `cancelled` is not
 * immutable in `shouldIgnoreDownloadUpdate`, so a later authoritative
 * `completed` still replaces it; the stale error from any premature `failed`
 * message is dropped because it no longer describes this entry.
 */
function finalizeCancellation(download: AssetDownload) {
  download.status = 'cancelled'
  download.error = undefined
  download.lastUpdate = Date.now()
}

/**
 * Record a reconciliation attempt that left a pending cancellation unresolved,
 * exposing an unconfirmed but dismissible state once the attempts are
 * exhausted. A later WebSocket completion can still replace it, but polling
 * stops once the bounded reconciliation window is exhausted.
 */
function noteAuthoritativePendingCancellation(download: AssetDownload) {
  if (download.status !== 'cancellation_pending') return

  const attempts = (download.cancellationReconcileAttempts ?? 0) + 1
  download.cancellationReconcileAttempts = attempts
  if (attempts >= MAX_CANCELLATION_RECONCILE_ATTEMPTS) {
    download.status = 'cancellation_unconfirmed'
    download.lastUpdate = Date.now()
  }
}

function resultValue<T>(value: T | undefined, fallback: T | undefined) {
  return value === undefined ? fallback : value
}

function requiredResultValue<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value
}

function createReconciledDownloadMessage(
  download: AssetDownload,
  task: TaskResponse
): AssetDownloadWsMessage | undefined {
  const result = parseDownloadFileResult(task.result)
  // The task status is authoritative even when an older backend returns a
  // result shape we cannot parse. Preserve the fields learned from the socket
  // so the row can still settle instead of polling forever.
  const reconciledResult: Partial<DownloadFileResult> = result ?? {}
  const assetId = resultValue(reconciledResult.asset_id, download.assetId)
  const assetName = requiredResultValue(
    reconciledResult.filename,
    download.assetName
  )
  const bytesDownloaded = requiredResultValue(
    reconciledResult.bytes_downloaded,
    download.bytesDownloaded
  )
  const error = resultValue(task.error_message, reconciledResult.error)
  return {
    task_id: download.taskId,
    asset_id: assetId,
    asset_name: assetName,
    bytes_total: download.bytesTotal,
    bytes_downloaded: bytesDownloaded,
    progress: task.status === 'completed' ? 100 : download.progress,
    status: task.status,
    error
  }
}

function canCancelDownload(
  download: AssetDownload | undefined,
  isCancelling: boolean
) {
  if (!download || isCancelling) return false
  return activeStatuses.has(download.status) || download.status === 'failed'
}

function isSettledDownload(download: AssetDownload) {
  return (
    download.status === 'completed' ||
    download.status === 'cancelled' ||
    download.status === 'cancellation_unconfirmed'
  )
}

function beginPendingCancellation(download: AssetDownload) {
  download.status = 'cancellation_pending'
  download.error = undefined
  download.cancellationReconcileAttempts = 0
  download.lastUpdate = Date.now()
}

function settleUnknownDownloadStatus(
  existing: AssetDownload | undefined,
  data: AssetDownloadWsMessage
) {
  if (
    !existing ||
    isSettledDownload(existing) ||
    existing.status === 'cancellation_pending' ||
    existing.status === 'failed'
  )
    return
  existing.status = 'failed'
  existing.error = data.error || `Unknown task status: ${data.status}`
  existing.lastUpdate = Date.now()
}

export const useAssetDownloadStore = defineStore('assetDownload', () => {
  const downloads = ref<Map<string, AssetDownload>>(new Map())
  const cancellingTaskIds = ref(new Set<TaskId>())
  const reconcilingTasks = new Map<TaskId, Promise<void>>()
  const dismissedPendingDownloads = new Map<TaskId, string | undefined>()
  const taskNotFoundAttempts = new Map<TaskId, number>()
  const unavailableTaskIds = new Set<TaskId>()
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
    downloadList.value.filter(
      (download) =>
        isDownloadRecheckable(download.status) &&
        !unavailableTaskIds.has(download.taskId)
    )
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

    dismissedPendingDownloads.delete(taskId)
    taskNotFoundAttempts.delete(taskId)
    unavailableTaskIds.delete(taskId)
    downloads.value.set(
      taskId,
      generateDownloadTrackingPlaceholder(taskId, modelType, assetName)
    )
  }

  function rememberDismissedDownload(download: AssetDownload) {
    dismissedPendingDownloads.delete(download.taskId)
    dismissedPendingDownloads.set(download.taskId, download.modelType)
    while (dismissedPendingDownloads.size > MAX_DISMISSED_DOWNLOADS) {
      const oldestTaskId = dismissedPendingDownloads.keys().next().value
      if (oldestTaskId === undefined) break
      dismissedPendingDownloads.delete(oldestTaskId)
    }
  }

  function consumeDismissedDownload(data: AssetDownloadWsMessage): boolean {
    if (!dismissedPendingDownloads.has(data.task_id)) return false

    const modelType = dismissedPendingDownloads.get(data.task_id)
    if (data.status === 'completed' && modelType) {
      lastCompletedDownload.value = {
        taskId: data.task_id,
        modelType,
        timestamp: Date.now()
      }
    }
    return true
  }

  function handleAssetDownload(e: CustomEvent<AssetDownloadWsMessage>) {
    const data = e.detail
    if (consumeDismissedDownload(data)) return
    if (unavailableTaskIds.has(data.task_id) && activeStatuses.has(data.status))
      return
    const existing = downloads.value.get(data.task_id)

    // WebSocket payloads are not runtime-validated at the event boundary.
    // Unknown statuses must not create immortal, non-dismissible rows.
    if (!wireTaskStatuses.has(data.status)) {
      settleUnknownDownloadStatus(existing, data)
      return
    }

    if (shouldIgnoreDownloadUpdate(existing?.status, data.status)) return

    if (activeStatuses.has(data.status)) {
      taskNotFoundAttempts.delete(data.task_id)
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

  function handleTaskNotFound(download: AssetDownload) {
    if (download.status === 'cancellation_pending') {
      taskNotFoundAttempts.delete(download.taskId)
      finalizeCancellation(download)
      return
    }

    const attempts = (taskNotFoundAttempts.get(download.taskId) ?? 0) + 1
    taskNotFoundAttempts.set(download.taskId, attempts)
    if (attempts < MAX_TASK_NOT_FOUND_ATTEMPTS) {
      download.lastUpdate = Date.now()
      return
    }
    taskNotFoundAttempts.delete(download.taskId)
    unavailableTaskIds.add(download.taskId)
    download.status = 'failed'
    download.error = t('progressToast.taskUnavailable')
    download.lastUpdate = Date.now()
  }

  async function runReconciliation(download: AssetDownload) {
    const result = await taskService.getTask(download.taskId)
    if (downloads.value.get(download.taskId) !== download) return

    if (!result.ok) {
      // A 404 is authoritative: the task row is gone, so a pending
      // cancellation has nothing left to wait for. Other lookup failures are
      // transient and must not consume the authoritative reconciliation bound.
      if (result.error instanceof TaskNotFoundError) {
        handleTaskNotFound(download)
      } else {
        taskNotFoundAttempts.delete(download.taskId)
      }
      return
    }

    taskNotFoundAttempts.delete(download.taskId)
    const task = result.value
    if (
      download.status === 'cancellation_pending' &&
      activeStatuses.has(task.status)
    ) {
      noteAuthoritativePendingCancellation(download)
      return
    }

    const message = createReconciledDownloadMessage(download, task)
    if (!message) {
      download.lastUpdate = Date.now()
      noteAuthoritativePendingCancellation(download)
      return
    }
    handleAssetDownload(
      new CustomEvent('asset_download', {
        detail: message
      })
    )
  }

  async function reconcileDownload(
    download: AssetDownload,
    rereadAfterInFlight = false
  ) {
    const inFlight = reconcilingTasks.get(download.taskId)
    if (inFlight) {
      if (!rereadAfterInFlight) return
      await inFlight
      const latest = downloads.value.get(download.taskId)
      if (!latest || isSettledDownload(latest)) return
      download = latest
    }

    const reconciliation = runReconciliation(download)
    reconcilingTasks.set(download.taskId, reconciliation)
    try {
      await reconciliation
    } finally {
      if (reconcilingTasks.get(download.taskId) === reconciliation) {
        reconcilingTasks.delete(download.taskId)
      }
    }
  }

  async function pollStaleDownloads() {
    const now = Date.now()
    const staleDownloads = recheckableDownloads.value.filter(
      (d) => now - d.lastUpdate >= STALE_THRESHOLD_MS
    )

    if (staleDownloads.length === 0) return

    await Promise.all(
      staleDownloads.map((download) => reconcileDownload(download))
    )
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
      rememberDismissedDownload(download)
      taskNotFoundAttempts.delete(download.taskId)
      unavailableTaskIds.delete(download.taskId)
      downloads.value.delete(download.taskId)
    }
  }

  function clearDismissibleDownloads() {
    for (const download of downloadList.value) {
      if (
        isDownloadFinished(download.status) ||
        download.status === 'cancellation_pending'
      ) {
        rememberDismissedDownload(download)
        taskNotFoundAttempts.delete(download.taskId)
        unavailableTaskIds.delete(download.taskId)
        downloads.value.delete(download.taskId)
      }
    }
  }

  async function cancelDownload(taskId: TaskId): Promise<TaskResult<boolean>> {
    const download = downloads.value.get(taskId)
    if (!canCancelDownload(download, cancellingTaskIds.value.has(taskId))) {
      return { ok: true, value: false }
    }
    cancellingTaskIds.value.add(taskId)
    try {
      const result = await taskService.cancelTask(taskId)
      if (!result.ok) return result

      const current = downloads.value.get(taskId)
      if (!current) return { ok: true, value: false }
      if (isSettledDownload(current)) {
        return { ok: true, value: result.value === 'cancelling' }
      }
      unavailableTaskIds.delete(taskId)

      // A DELETE 404 can mean the cancellation route is unavailable, not that
      // the task is gone. Re-read the task before deciding how to settle it.
      if (result.value === 'missing') {
        beginPendingCancellation(current)
        await reconcileDownload(current, true)
        const latest = downloads.value.get(taskId)
        if (!latest) return { ok: true, value: false }
        if (latest.status === 'cancelled') return { ok: true, value: true }
        return { ok: true, value: false }
      }

      // The backend refused. Re-read the task so the row moves to whatever
      // status it is really in, instead of silently re-enabling Cancel.
      if (result.value === 'not-cancellable') {
        await reconcileDownload(current, true)
        return { ok: true, value: false }
      }

      beginPendingCancellation(current)
      return { ok: true, value: true }
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
    clearDismissibleDownloads,
    clearFinishedDownloads,
    isDownloadedThisSession,
    acknowledgeAsset
  }
})
