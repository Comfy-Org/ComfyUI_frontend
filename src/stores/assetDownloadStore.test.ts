import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CancelTaskOutcome,
  TaskResponse,
  TaskResult
} from '@/platform/tasks/services/taskService'
import {
  TaskNotFoundError,
  taskService
} from '@/platform/tasks/services/taskService'
import type { AssetDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'
import {
  isDownloadCancelled,
  useAssetDownloadStore
} from '@/stores/assetDownloadStore'

type DownloadEventHandler = (e: CustomEvent<AssetDownloadWsMessage>) => void

const eventHandler = vi.hoisted(() => {
  const state: { current: DownloadEventHandler | null } = { current: null }
  return state
})

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    addEventListener: vi.fn((_event: string, handler: DownloadEventHandler) => {
      eventHandler.current = handler
    }),
    removeEventListener: vi.fn()
  }
}))

function createDownloadMessage(
  overrides: Partial<AssetDownloadWsMessage> = {}
): AssetDownloadWsMessage {
  return {
    task_id: 'task-123',
    asset_id: 'asset-456',
    asset_name: 'model.safetensors',
    bytes_total: 1000,
    bytes_downloaded: 500,
    progress: 50,
    status: 'running',
    ...overrides
  }
}

function createTaskResponse(
  overrides: Partial<TaskResponse> = {}
): TaskResponse {
  return {
    id: 'task-123',
    idempotency_key: 'key-123',
    task_name: 'task:download_file',
    payload: {},
    status: 'completed',
    create_time: new Date().toISOString(),
    update_time: new Date().toISOString(),
    result: {
      success: true,
      asset_id: 'asset-456',
      filename: 'model.safetensors',
      bytes_downloaded: 1000
    },
    ...overrides
  }
}

function dispatch(msg: AssetDownloadWsMessage) {
  if (!eventHandler.current) {
    throw new Error(
      'Event handler not registered. Call useAssetDownloadStore() first.'
    )
  }
  eventHandler.current(new CustomEvent('asset_download', { detail: msg }))
}

describe('useAssetDownloadStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    eventHandler.current = null
    // Only the service calls are stubbed. `TaskNotFoundError` and the result
    // parser stay real because the store branches on them.
    vi.spyOn(taskService, 'getTask')
    vi.spyOn(taskService, 'cancelTask')
  })

  describe('handleAssetDownload', () => {
    it('tracks running downloads', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage())

      expect(store.activeDownloads).toHaveLength(1)
      expect(store.activeDownloads[0].taskId).toBe('task-123')
      expect(store.activeDownloads[0].progress).toBe(50)
    })

    it('moves download to finished when completed', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'running' }))
      expect(store.activeDownloads).toHaveLength(1)

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads).toHaveLength(1)
      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('moves download to finished when failed', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'running' }))
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads).toHaveLength(1)
      expect(store.finishedDownloads[0].status).toBe('failed')
      expect(store.finishedDownloads[0].error).toBe('Network error')
    })

    it('ignores duplicate terminal state messages', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.finishedDownloads).toHaveLength(1)
    })

    it('preserves a completed download when a later event has an unknown status', () => {
      const store = useAssetDownloadStore()
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      dispatch(
        createDownloadMessage({
          status: 'unknown' as AssetDownloadWsMessage['status'],
          error: 'Unsupported status'
        })
      )

      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        progress: 100,
        error: undefined
      })
      expect(store.sessionDownloadCount).toBe(1)
      expect(store.isDownloadedThisSession('asset-456')).toBe(true)
    })

    it('does not resurrect a dismissed pending cancellation on late events', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      store.clearDismissibleDownloads()
      dispatch(createDownloadMessage({ status: 'running', progress: 0.75 }))

      expect(store.downloadList).toHaveLength(0)

      dispatch(createDownloadMessage({ status: 'failed' }))
      dispatch(createDownloadMessage({ status: 'running', progress: 0.5 }))
      expect(store.downloadList).toHaveLength(0)

      dispatch(createDownloadMessage({ status: 'completed', progress: 1 }))
      expect(store.downloadList).toHaveLength(0)
      expect(store.lastCompletedDownload).toMatchObject({
        taskId: 'task-123',
        modelType: 'checkpoints'
      })

      // Late progress after a terminal frame is still part of the dismissed
      // task and must not reopen the toast.
      dispatch(createDownloadMessage({ status: 'running', progress: 0.25 }))
      expect(store.downloadList).toHaveLength(0)
    })

    it('does not resurrect a dismissed unconfirmed cancellation on late events', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(60_000)
      expect(store.downloadList[0].status).toBe('cancellation_unconfirmed')

      store.clearDismissibleDownloads()
      dispatch(createDownloadMessage({ status: 'running', progress: 0.75 }))
      expect(store.downloadList).toHaveLength(0)

      dispatch(createDownloadMessage({ status: 'completed', progress: 1 }))
      expect(store.downloadList).toHaveLength(0)
      expect(store.lastCompletedDownload).toMatchObject({
        taskId: 'task-123',
        modelType: 'checkpoints'
      })
    })

    it('allows explicit tracking to reuse a dismissed task id', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      store.trackDownload('task-123', 'checkpoints', 'first.safetensors')
      dispatch(createDownloadMessage({ status: 'running' }))
      await store.cancelDownload('task-123')
      store.clearDismissibleDownloads()

      store.trackDownload('task-123', 'loras', 'second.safetensors')
      dispatch(
        createDownloadMessage({
          status: 'running',
          asset_name: 'second.safetensors'
        })
      )

      expect(store.downloadList).toEqual([
        expect.objectContaining({
          taskId: 'task-123',
          modelType: 'loras',
          assetName: 'second.safetensors'
        })
      ])
    })

    // REGRESSION COVERAGE PM-1302 / PM-1309: cloud's HandleDownloadFile
    // (download_file.go) can broadcast a terminal `failed` WS message for a
    // retryable error before asynq decides whether to retry, then
    // StatusMiddleware.ProcessTask quietly resets the task to pending and
    // asynq retries it. handleAssetDownload now treats `failed` as
    // recoverable (only `completed` is a trusted terminal state), so a later
    // `completed` message for the same task_id still updates the store.
    it('does not get stuck on a premature failed status once a later completed message arrives (PM-1302)', () => {
      const store = useAssetDownloadStore()

      // Backend reported a retryable error as a terminal failure...
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )
      // ...then silently retried and actually succeeded.
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.finishedDownloads[0].status).toBe('completed')
      expect(store.finishedDownloads[0].error).toBeUndefined()
    })

    // OPEN DESIGN QUESTION PM-1302 / PM-1309: `activeDownloads` is also the
    // UI's `isInProgress` signal (see ModelImportProgressDialog.vue), and an
    // existing, unmarked test above ("moves download to finished when
    // failed") requires a `failed` download to leave `activeDownloads` so
    // the dialog can show its failed state and close button. Reconciliation
    // of a `failed`-then-actually-`completed` task is now handled
    // separately (pollStaleDownloads() re-checks `failed` downloads too, and
    // a later WS message is no longer dropped - see the test above), but
    // deliberately without pulling `failed` downloads back into
    // `activeDownloads`, which would make the dialog show them as
    // in-progress again. Changing that UI-facing meaning of `activeDownloads`
    // is a product decision, not a mechanical fix, so this assertion is left
    // pinned as a known, deliberate gap for further discussion rather than
    // flipped.
    it.fails('excludes a failed-then-actually-completed task from activeDownloads so it is never reconciled (PM-1302)', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'running' }))
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )

      // The task never actually stopped on the backend - it retried and
      // completed - but it was dropped from activeDownloads the moment the
      // premature `failed` message landed, so pollStaleDownloads()
      // (which only walks activeDownloads) will never pick it back up to
      // reconcile with the real, later `completed` message.
      expect(store.activeDownloads).toHaveLength(1)
    })
  })

  describe('trackDownload', () => {
    it('associates task with model type for completion tracking', () => {
      const store = useAssetDownloadStore()

      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.lastCompletedDownload).toMatchObject({
        taskId: 'task-123',
        modelType: 'checkpoints'
      })
    })

    it('handles out-of-order messages where completed arrives before progress', () => {
      const store = useAssetDownloadStore()

      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      dispatch(createDownloadMessage({ status: 'running', progress: 50 }))

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads).toHaveLength(1)
      expect(store.finishedDownloads[0].status).toBe('completed')
      expect(store.lastCompletedDownload?.modelType).toBe('checkpoints')
    })

    it('ignores late progress while cancellation is pending', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      dispatch(createDownloadMessage({ status: 'running', progress: 25 }))

      await store.cancelDownload('task-123')
      dispatch(createDownloadMessage({ status: 'running', progress: 50 }))

      expect(store.downloadList[0]).toMatchObject({
        status: 'cancellation_pending',
        progress: 25,
        cancellationReconcileAttempts: 0
      })
    })
  })

  describe('cancelDownload', () => {
    it('keeps an accepted cancellation provisional until the backend confirms it', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')

      expect(taskService.cancelTask).toHaveBeenCalledWith('task-123')
      expect(store.activeDownloads).toHaveLength(0)
      expect(store.downloadList[0].status).toBe('cancellation_pending')
      expect(store.finishedDownloads).toHaveLength(0)
    })

    it('cancels a queued backend task', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      dispatch(createDownloadMessage({ status: 'created' }))

      await store.cancelDownload('task-123')

      expect(taskService.cancelTask).toHaveBeenCalledWith('task-123')
      expect(store.downloadList[0].status).toBe('cancellation_pending')
      expect(store.finishedDownloads).toHaveLength(0)
    })

    it('allows cancelling a failed row while the backend may still retry it', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      dispatch(createDownloadMessage({ status: 'failed' }))

      await store.cancelDownload('task-123')

      expect(taskService.cancelTask).toHaveBeenCalledWith('task-123')
      expect(store.downloadList[0].status).toBe('cancellation_pending')
    })

    it('keeps the download active and allows retry when cancellation fails', async () => {
      const store = useAssetDownloadStore()
      const error = new Error('network')
      vi.mocked(taskService.cancelTask)
        .mockResolvedValueOnce({ ok: false, error })
        .mockResolvedValueOnce({ ok: true, value: 'cancelling' })
      dispatch(createDownloadMessage({ status: 'running' }))

      await expect(store.cancelDownload('task-123')).resolves.toEqual({
        ok: false,
        error
      })
      expect(store.activeDownloads).toHaveLength(1)
      expect(store.cancellingTaskIds.has('task-123')).toBe(false)

      await store.cancelDownload('task-123')

      expect(taskService.cancelTask).toHaveBeenCalledTimes(2)
    })

    it('keeps polling after the backend refuses to cancel a still-running task', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'not-cancellable'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')

      expect(store.activeDownloads).toHaveLength(1)
    })

    it('shows the real status when the backend refuses to cancel', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'not-cancellable'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse()
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')

      // Without this reconciliation the refusal is a silent no-op: the row
      // stays `running` and Cancel simply re-enables.
      expect(taskService.getTask).toHaveBeenCalledWith('task-123')
      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        assetId: 'asset-456'
      })
    })

    it('rereads after an in-flight poll when cancellation is refused', async () => {
      const store = useAssetDownloadStore()
      let resolvePoll!: (value: TaskResult<TaskResponse>) => void
      vi.mocked(taskService.getTask)
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolvePoll = resolve
          })
        )
        .mockResolvedValueOnce({ ok: true, value: createTaskResponse() })
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'not-cancellable'
      })
      dispatch(createDownloadMessage({ status: 'running' }))
      await vi.advanceTimersByTimeAsync(10_000)

      const cancellation = store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(0)
      resolvePoll({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })
      await cancellation

      expect(taskService.getTask).toHaveBeenCalledTimes(2)
      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        assetId: 'asset-456'
      })
    })

    it('confirms a DELETE 404 with a task lookup before settling', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'missing'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: false,
        error: new TaskNotFoundError('task-123')
      })
      dispatch(
        createDownloadMessage({ status: 'running', error: 'Source timeout' })
      )

      await store.cancelDownload('task-123')

      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'cancelled',
        error: undefined
      })
      expect(taskService.getTask).toHaveBeenCalledWith('task-123')
    })

    it('shows pending cancellation when a DELETE 404 reread is still running', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'missing'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')

      expect(store.downloadList[0].status).toBe('cancellation_pending')
      expect(store.hasPendingCancellation).toBe(true)
    })

    it('allows an authoritative completion to replace confirmed cancellation', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      dispatch(createDownloadMessage({ status: 'running' }))
      await store.cancelDownload('task-123')

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('preserves a completion that arrives while cancellation is pending', async () => {
      const store = useAssetDownloadStore()
      let resolveCancellation!: (result: TaskResult<CancelTaskOutcome>) => void
      vi.mocked(taskService.cancelTask).mockImplementation(
        () =>
          new Promise<TaskResult<CancelTaskOutcome>>((resolve) => {
            resolveCancellation = resolve
          })
      )
      dispatch(createDownloadMessage({ status: 'running' }))

      const cancellation = store.cancelDownload('task-123')
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))
      resolveCancellation({ ok: true, value: 'cancelling' })
      await cancellation

      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('does not send duplicate cancellation requests while one is pending', async () => {
      const store = useAssetDownloadStore()
      let resolveCancellation!: (result: TaskResult<CancelTaskOutcome>) => void
      vi.mocked(taskService.cancelTask).mockImplementation(
        () =>
          new Promise<TaskResult<CancelTaskOutcome>>((resolve) => {
            resolveCancellation = resolve
          })
      )
      dispatch(createDownloadMessage({ status: 'running' }))

      const first = store.cancelDownload('task-123')
      const second = store.cancelDownload('task-123')
      expect(taskService.cancelTask).toHaveBeenCalledTimes(1)
      resolveCancellation({ ok: true, value: 'cancelling' })
      await Promise.all([first, second])
    })
  })

  describe('stale download polling', () => {
    it('polls and completes stale downloads', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse()
      })

      dispatch(createDownloadMessage({ status: 'running' }))
      expect(store.activeDownloads).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(45_000)

      expect(taskService.getTask).toHaveBeenCalledWith('task-123')
      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('reconciles a failed download through polling without another socket message', async () => {
      const store = useAssetDownloadStore()
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse()
      })
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )

      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        progress: 100,
        error: undefined
      })
      expect(store.sessionDownloadCount).toBe(1)
      expect(store.lastCompletedDownload?.modelType).toBe('checkpoints')
    })

    it('reconciles a locally cancelled download that completed authoritatively', async () => {
      const store = useAssetDownloadStore()
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse()
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(10_000)

      expect(taskService.getTask).toHaveBeenCalledWith('task-123')
      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        assetId: 'asset-456'
      })
      expect(store.lastCompletedDownload?.modelType).toBe('checkpoints')
    })

    it('recovers from an authoritative failure during cancellation', async () => {
      const store = useAssetDownloadStore()
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask)
        .mockResolvedValueOnce({
          ok: true,
          value: createTaskResponse({
            status: 'failed',
            error_message: 'Cancellation failed'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createTaskResponse()
        })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'failed',
        error: 'Cancellation failed'
      })

      await vi.advanceTimersByTimeAsync(60_000)

      expect(taskService.getTask).toHaveBeenCalledTimes(2)
      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        error: undefined
      })
    })

    it('preserves a provisional cancellation when finished downloads are cleared', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse()
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      store.clearFinishedDownloads()

      expect(store.downloadList[0].status).toBe('cancellation_pending')

      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        assetId: 'asset-456'
      })
    })

    it('stops reconciling after the backend confirms cancellation', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({
          status: 'cancelled',
          result: undefined
        })
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(20_000)

      expect(taskService.getTask).toHaveBeenCalledTimes(1)
      expect(store.finishedDownloads[0].status).toBe('cancelled')
    })

    it('settles a pending cancellation once the task row is purged', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      // An authoritative 404: the task row was purged after cancellation, so
      // no terminal status or successful poll will ever arrive.
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: false,
        error: new TaskNotFoundError('task-123')
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.finishedDownloads[0].status).toBe('cancelled')

      // The entry is terminal, so it stops being re-polled for the life of
      // the page.
      await vi.advanceTimersByTimeAsync(60_000)
      expect(taskService.getTask).toHaveBeenCalledTimes(1)
    })

    it('settles a running download after repeated task lookup 404s', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: false,
        error: new TaskNotFoundError('task-123')
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.activeDownloads).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'failed',
        error: 'The download task is no longer available.'
      })

      await vi.advanceTimersByTimeAsync(60_000)
      expect(taskService.getTask).toHaveBeenCalledTimes(2)
    })

    it('restarts reconciliation when cancelling a task-unavailable row', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.getTask)
        .mockResolvedValueOnce({
          ok: false,
          error: new TaskNotFoundError('task-123')
        })
        .mockResolvedValueOnce({
          ok: false,
          error: new TaskNotFoundError('task-123')
        })
        .mockResolvedValue({
          ok: true,
          value: createTaskResponse({ status: 'running', result: undefined })
        })
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      dispatch(createDownloadMessage({ status: 'running' }))
      await vi.advanceTimersByTimeAsync(20_000)
      expect(store.finishedDownloads[0].status).toBe('failed')

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(10_000)

      expect(taskService.getTask).toHaveBeenCalledTimes(3)
      expect(store.downloadList[0].status).toBe('cancellation_pending')
    })

    it('keeps reconciling a failed task so a backend retry can recover', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.getTask)
        .mockResolvedValueOnce({
          ok: true,
          value: createTaskResponse({
            status: 'failed',
            result: undefined,
            error_message: 'Retrying download'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createTaskResponse({ status: 'running', result: undefined })
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createTaskResponse({ status: 'completed' })
        })
      dispatch(createDownloadMessage({ status: 'failed' }))

      await vi.advanceTimersByTimeAsync(30_000)

      expect(taskService.getTask).toHaveBeenCalledTimes(3)
      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('accepts retry progress after an authoritative failed snapshot', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({
          status: 'failed',
          result: undefined,
          error_message: 'Download failed'
        })
      })
      dispatch(createDownloadMessage({ status: 'failed' }))
      await vi.advanceTimersByTimeAsync(10_000)

      dispatch(createDownloadMessage({ status: 'running', progress: 75 }))

      expect(store.activeDownloads[0]).toMatchObject({
        status: 'running',
        progress: 75
      })
    })

    it('requires consecutive task lookup 404s before settling', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.getTask)
        .mockResolvedValueOnce({
          ok: false,
          error: new TaskNotFoundError('task-123')
        })
        .mockResolvedValueOnce({
          ok: false,
          error: new Error('gateway unavailable')
        })
        .mockResolvedValueOnce({
          ok: false,
          error: new TaskNotFoundError('task-123')
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createTaskResponse({ status: 'running', result: undefined })
        })
      dispatch(createDownloadMessage({ status: 'running' }))

      await vi.advanceTimersByTimeAsync(40_000)

      expect(store.activeDownloads).toHaveLength(1)
      expect(store.finishedDownloads).toHaveLength(0)
    })

    it('settles a pending cancellation the backend never confirms', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      // The DELETE was accepted, but the task never leaves `running`.
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(50_000)

      // Still provisional: the backend is given a bounded number of chances.
      expect(store.downloadList[0].status).toBe('cancellation_pending')
      expect(store.finishedDownloads).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(10_000)

      // Bound reached, so the entry becomes dismissible without falsely
      // claiming the backend confirmed cancellation.
      expect(store.finishedDownloads[0].status).toBe('cancellation_unconfirmed')
      expect(store.hasPendingCancellation).toBe(false)

      // The unconfirmed state is terminal for polling; a late WebSocket
      // terminal event can still replace it.
      await vi.advanceTimersByTimeAsync(10_000)
      expect(taskService.getTask).toHaveBeenCalledTimes(6)
    })

    it('does not consume the cancellation bound on transient lookup failures', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: false,
        error: new Error('gateway unavailable')
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(120_000)

      expect(store.downloadList[0].status).toBe('cancellation_pending')
    })

    it('does not overlap slow reconciliation requests for one task', async () => {
      useAssetDownloadStore()
      let resolveResponse!: (value: TaskResult<TaskResponse>) => void
      vi.mocked(taskService.getTask).mockReturnValue(
        new Promise((resolve) => {
          resolveResponse = resolve
        })
      )
      dispatch(createDownloadMessage({ status: 'running' }))

      await vi.advanceTimersByTimeAsync(30_000)
      expect(taskService.getTask).toHaveBeenCalledTimes(1)

      resolveResponse({ ok: true, value: createTaskResponse() })
      await vi.advanceTimersByTimeAsync(0)
    })

    it('settles a completed task with a malformed result', async () => {
      const store = useAssetDownloadStore()
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({
          result: { filename: 'model.safetensors' }
        })
      })

      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.downloadList[0].status).toBe('completed')
      expect(store.finishedDownloads).toHaveLength(1)
    })

    it('accepts completed cancellation reconciliation with a malformed result', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({
          result: { filename: 'model.safetensors' }
        })
      })
      dispatch(
        createDownloadMessage({ status: 'running', asset_id: undefined })
      )

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(60_000)

      expect(taskService.getTask).toHaveBeenCalledTimes(1)
      expect(store.finishedDownloads[0].status).toBe('completed')
      expect(store.hasPendingCancellation).toBe(false)
    })

    it('still accepts an authoritative completion after a bounded cancellation', async () => {
      const store = useAssetDownloadStore()
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(60_000)
      expect(store.finishedDownloads[0].status).toBe('cancellation_unconfirmed')

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('drops a premature error when reconciling to cancelled', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'cancelled', result: undefined })
      })
      // The backend attached an error to a still-running download, then the
      // user cancelled it.
      dispatch(
        createDownloadMessage({
          status: 'running',
          error: 'Source server error'
        })
      )

      await store.cancelDownload('task-123')
      expect(store.downloadList[0].error).toBeUndefined()
      await vi.advanceTimersByTimeAsync(10_000)

      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'cancelled',
        error: undefined
      })
    })

    it('does not restore a dismissed failed download when an in-flight poll finishes', async () => {
      const store = useAssetDownloadStore()
      let resolveResponse!: (value: TaskResult<TaskResponse>) => void
      const response = new Promise<TaskResult<TaskResponse>>((resolve) => {
        resolveResponse = resolve
      })
      vi.mocked(taskService.getTask).mockReturnValue(response)
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )
      await vi.advanceTimersByTimeAsync(10_000)
      expect(taskService.getTask).toHaveBeenCalledWith('task-123')

      store.clearFinishedDownloads()
      resolveResponse({
        ok: true,
        value: createTaskResponse({ status: 'failed' })
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.hasDownloads).toBe(false)
    })

    it('does not restore a dismissed confirmed cancellation from late progress', () => {
      const store = useAssetDownloadStore()
      dispatch(createDownloadMessage({ status: 'cancelled' }))

      store.clearFinishedDownloads()
      dispatch(createDownloadMessage({ status: 'running', progress: 80 }))

      expect(store.downloadList).toHaveLength(0)
    })

    it('polls and marks failed downloads', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({
          status: 'failed',
          error_message: 'Download failed',
          result: { success: false, error: 'Network error' }
        })
      })

      dispatch(createDownloadMessage({ status: 'running' }))
      await vi.advanceTimersByTimeAsync(45_000)

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads[0].status).toBe('failed')
      expect(store.finishedDownloads[0].error).toBe('Download failed')
    })

    it('does not complete if task still running', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })

      dispatch(createDownloadMessage({ status: 'running' }))
      await vi.advanceTimersByTimeAsync(45_000)

      expect(taskService.getTask).toHaveBeenCalled()
      expect(store.activeDownloads).toHaveLength(1)
    })

    it('continues tracking on polling error', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: false,
        error: new Error('Not found')
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await vi.advanceTimersByTimeAsync(45_000)

      expect(store.activeDownloads).toHaveLength(1)
    })
  })

  describe('clearFinishedDownloads', () => {
    it('removes all finished downloads', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))
      expect(store.finishedDownloads).toHaveLength(1)

      store.clearFinishedDownloads()

      expect(store.finishedDownloads).toHaveLength(0)
    })

    it('keeps a cleared unconfirmed cancellation hidden from late progress', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: 'cancelling'
      })
      vi.mocked(taskService.getTask).mockResolvedValue({
        ok: true,
        value: createTaskResponse({ status: 'running', result: undefined })
      })
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      dispatch(createDownloadMessage({ status: 'running' }))
      await store.cancelDownload('task-123')
      await vi.advanceTimersByTimeAsync(60_000)

      store.clearFinishedDownloads()
      dispatch(createDownloadMessage({ status: 'running', progress: 75 }))

      expect(store.downloadList).toHaveLength(0)
    })
  })

  it('classifies an unconfirmed cancellation as cancelled for the UI', () => {
    expect(isDownloadCancelled('cancellation_unconfirmed')).toBe(true)
  })

  describe('session download tracking', () => {
    it('counts unacknowledged completed downloads with asset IDs', () => {
      const store = useAssetDownloadStore()

      dispatch(
        createDownloadMessage({
          status: 'completed',
          progress: 100,
          asset_id: 'asset-456'
        })
      )

      expect(store.sessionDownloadCount).toBe(1)
    })

    it('does not count completed downloads without asset IDs', () => {
      const store = useAssetDownloadStore()

      dispatch(
        createDownloadMessage({
          status: 'completed',
          progress: 100,
          asset_id: undefined
        })
      )

      expect(store.sessionDownloadCount).toBe(0)
    })

    it('does not count failed downloads', () => {
      const store = useAssetDownloadStore()

      dispatch(
        createDownloadMessage({
          status: 'failed',
          asset_id: 'asset-456'
        })
      )

      expect(store.sessionDownloadCount).toBe(0)
    })

    it('isDownloadedThisSession returns true for unacknowledged downloads', () => {
      const store = useAssetDownloadStore()

      dispatch(
        createDownloadMessage({
          status: 'completed',
          progress: 100,
          asset_id: 'asset-456'
        })
      )

      expect(store.isDownloadedThisSession('asset-456')).toBe(true)
      expect(store.isDownloadedThisSession('other-asset')).toBe(false)
    })

    it('acknowledgeAsset decrements session count', () => {
      const store = useAssetDownloadStore()

      dispatch(
        createDownloadMessage({
          status: 'completed',
          progress: 100,
          asset_id: 'asset-456'
        })
      )
      expect(store.sessionDownloadCount).toBe(1)

      store.acknowledgeAsset('asset-456')

      expect(store.sessionDownloadCount).toBe(0)
      expect(store.isDownloadedThisSession('asset-456')).toBe(false)
    })
  })
})
