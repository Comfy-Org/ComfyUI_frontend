import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { assetService } from '@/platform/assets/services/assetService'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type {
  TaskId,
  TaskResponse,
  TaskResult,
  TaskStatus
} from '@/platform/tasks/services/taskService'
import {
  TaskNotFoundError,
  taskService
} from '@/platform/tasks/services/taskService'
import type { AssetExportWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { t } from '@/i18n'

export interface AssetExport {
  taskId: TaskId
  exportName: string
  assetsTotal: number
  assetsAttempted: number
  assetsFailed: number
  bytesTotal: number
  bytesProcessed: number
  progress: number
  status: TaskStatus
  error?: string
  downloadError?: string
  lastUpdate: number
  downloadTriggered: boolean
}

const STALE_THRESHOLD_MS = 10_000
const POLL_INTERVAL_MS = 10_000
const MAX_TASK_NOT_FOUND_ATTEMPTS = 2

/**
 * `DELETE /tasks/{id}` is task-type agnostic, so an export can be cancelled
 * server-side even though this store offers no cancel control. Treating
 * `cancelled` as finished is what lets such an export leave `activeExports`,
 * stop being polled, and be cleared by `clearFinishedExports`.
 */
const finishedExportStatuses = new Set<TaskStatus>([
  'completed',
  'failed',
  'cancelled'
])
const wireExportStatuses = new Set<string>([
  'created',
  'running',
  ...finishedExportStatuses
])

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback
}

function shouldIgnoreExportUpdate(
  existing: AssetExport | undefined,
  data: AssetExportWsMessage
): boolean {
  const ignoresCompleted =
    existing?.status === 'completed' &&
    !(
      data.status === 'completed' &&
      !existing.exportName &&
      data.export_name !== undefined
    )
  const ignoresFailed =
    existing?.status === 'failed' && existing.downloadTriggered
  const ignoresCancelled =
    existing?.status === 'cancelled' && data.status !== 'completed'
  return ignoresCompleted || ignoresFailed || ignoresCancelled
}

function settleUnknownExportStatus(
  existing: AssetExport | undefined,
  data: AssetExportWsMessage
): boolean {
  if (wireExportStatuses.has(data.status)) return false
  if (existing) {
    existing.status = 'failed'
    existing.error = data.error || `Unknown task status: ${data.status}`
    existing.lastUpdate = Date.now()
  }
  return true
}

function resolveExportDownloadUrl(
  url: string
): { ok: true; value: URL } | { ok: false; error: string } {
  const trimmedUrl = url.trim()
  if (
    !trimmedUrl ||
    trimmedUrl.startsWith('//') ||
    trimmedUrl.startsWith('\\\\') ||
    trimmedUrl.startsWith('/\\')
  ) {
    return { ok: false, error: t('exportToast.unsupportedDownloadUrl') }
  }
  const resolvedUrl = trimmedUrl.startsWith('/')
    ? api.apiURL(trimmedUrl)
    : trimmedUrl
  let parsedUrl: URL
  try {
    parsedUrl = new URL(resolvedUrl, document.baseURI)
  } catch {
    return { ok: false, error: t('exportToast.unsupportedDownloadUrl') }
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { ok: false, error: t('exportToast.unsupportedDownloadUrl') }
  }
  return { ok: true, value: parsedUrl }
}

export const useAssetExportStore = defineStore('assetExport', () => {
  const exports = ref<Map<TaskId, AssetExport>>(new Map())
  const pollingTaskIds = new Set<TaskId>()
  const taskNotFoundAttempts = new Map<TaskId, number>()

  const exportList = computed(() => Array.from(exports.value.values()))
  const activeExports = computed(() =>
    exportList.value.filter(
      (e) => e.status === 'created' || e.status === 'running'
    )
  )
  const finishedExports = computed(() =>
    exportList.value.filter((e) => finishedExportStatuses.has(e.status))
  )
  const hasActiveExports = computed(() => activeExports.value.length > 0)
  const hasExports = computed(() => exports.value.size > 0)

  function trackExport(taskId: TaskId) {
    if (exports.value.has(taskId)) return

    exports.value.set(taskId, {
      taskId,
      exportName: '',
      assetsTotal: 0,
      assetsAttempted: 0,
      assetsFailed: 0,
      bytesTotal: 0,
      bytesProcessed: 0,
      progress: 0,
      status: 'created',
      lastUpdate: Date.now(),
      downloadTriggered: false
    })
  }

  async function triggerDownload(exp: AssetExport, force = false) {
    if (!force && (exp.downloadTriggered || !exp.exportName)) return
    exp.downloadTriggered = true

    try {
      exp.downloadError = undefined
      const { url } = await assetService.getExportDownloadUrl(exp.exportName)
      const resolvedUrl = resolveExportDownloadUrl(url)
      if (!resolvedUrl.ok) {
        exp.downloadError = resolvedUrl.error
        exp.downloadTriggered = false
        useToastStore().add({
          severity: 'error',
          summary: t('exportToast.downloadFailed', { name: exp.exportName }),
          detail: resolvedUrl.error
        })
        return
      }
      const link = document.createElement('a')
      link.href = url
      link.download = exp.exportName
      link.style.display = 'none'
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      exp.downloadError = message
      exp.downloadTriggered = false

      useToastStore().add({
        severity: 'error',
        summary: t('exportToast.downloadFailed', {
          name: exp.exportName
        }),
        detail: message
      })
    }
  }

  function handleAssetExport(data: AssetExportWsMessage) {
    const existing = exports.value.get(data.task_id)

    // Completion is authoritative even when fetching the signed URL failed;
    // late progress/cancellation frames must not revive polling or erase the
    // retryable download error.
    // A cancelled export is only superseded by an authoritative completion;
    // a stale progress message must not revive it and resume polling.
    if (shouldIgnoreExportUpdate(existing, data)) return
    if (settleUnknownExportStatus(existing, data)) return

    const exp: AssetExport = {
      taskId: data.task_id,
      exportName: data.export_name ?? existing?.exportName ?? '',
      assetsTotal: data.assets_total,
      assetsAttempted: data.assets_attempted,
      assetsFailed: data.assets_failed,
      bytesTotal: data.bytes_total,
      bytesProcessed: data.bytes_processed,
      progress: data.progress,
      status: data.status,
      error: data.error,
      lastUpdate: Date.now(),
      downloadTriggered: existing?.downloadTriggered ?? false
    }

    exports.value.set(data.task_id, exp)

    if (data.status === 'completed') {
      void triggerDownload(exp)
    }
  }

  async function pollStaleExports() {
    const now = Date.now()
    const staleExports = activeExports.value.filter(
      (e) => now - e.lastUpdate >= STALE_THRESHOLD_MS
    )

    if (staleExports.length === 0) return

    function handleMissingExportTask(exp: AssetExport) {
      const attempts = (taskNotFoundAttempts.get(exp.taskId) ?? 0) + 1
      taskNotFoundAttempts.set(exp.taskId, attempts)
      if (attempts < MAX_TASK_NOT_FOUND_ATTEMPTS) {
        exp.lastUpdate = Date.now()
        return
      }
      taskNotFoundAttempts.delete(exp.taskId)
      handleAssetExport({
        task_id: exp.taskId,
        export_name: exp.exportName,
        assets_total: exp.assetsTotal,
        assets_attempted: exp.assetsAttempted,
        assets_failed: exp.assetsFailed,
        bytes_total: exp.bytesTotal,
        bytes_processed: exp.bytesProcessed,
        progress: exp.progress,
        status: 'failed',
        error: t('progressToast.failed')
      })
    }

    function applyFinishedExport(
      exp: AssetExport,
      result: Extract<TaskResult<TaskResponse>, { ok: true }>
    ) {
      const task = result.value
      if (!finishedExportStatuses.has(task.status)) return
      const taskResult = task.result ?? {}
      handleAssetExport({
        task_id: exp.taskId,
        export_name: stringValue(taskResult.export_name, exp.exportName),
        assets_total: numberValue(taskResult.assets_total, exp.assetsTotal),
        assets_attempted: numberValue(
          taskResult.assets_attempted,
          exp.assetsAttempted
        ),
        assets_failed: numberValue(taskResult.assets_failed, exp.assetsFailed),
        bytes_total: exp.bytesTotal,
        bytes_processed: exp.bytesTotal,
        progress: task.status === 'completed' ? 1 : exp.progress,
        status: task.status,
        error: task.error_message ?? stringValue(taskResult.error, '')
      })
    }

    async function pollSingleExport(exp: AssetExport) {
      if (pollingTaskIds.has(exp.taskId)) return
      pollingTaskIds.add(exp.taskId)
      try {
        const result = await taskService.getTask(exp.taskId)
        // Without this identity guard, a poll that resolves after the user
        // dismissed the toast re-inserts the export with `downloadTriggered`
        // false, which resurrects it and downloads the archive a second time.
        if (exports.value.get(exp.taskId) !== exp) return
        if (!result.ok) {
          if (result.error instanceof TaskNotFoundError) {
            handleMissingExportTask(exp)
          } else {
            taskNotFoundAttempts.delete(exp.taskId)
          }
          return
        }
        taskNotFoundAttempts.delete(exp.taskId)
        applyFinishedExport(exp, result)
      } finally {
        pollingTaskIds.delete(exp.taskId)
      }
    }

    await Promise.all(staleExports.map(pollSingleExport))
  }

  const { pause, resume } = useIntervalFn(
    () => void pollStaleExports(),
    POLL_INTERVAL_MS,
    { immediate: false }
  )

  watch(
    hasActiveExports,
    (hasActive) => {
      if (hasActive) resume()
      else pause()
    },
    { immediate: true }
  )

  api.addEventListener('asset_export', (e) => handleAssetExport(e.detail))

  function clearFinishedExports() {
    for (const exp of finishedExports.value) {
      taskNotFoundAttempts.delete(exp.taskId)
      exports.value.delete(exp.taskId)
    }
  }

  return {
    activeExports,
    finishedExports,
    hasActiveExports,
    hasExports,
    exportList,
    trackExport,
    triggerDownload,
    clearFinishedExports
  }
})
