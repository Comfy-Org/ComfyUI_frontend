import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  TaskResponse,
  TaskResult
} from '@/platform/tasks/services/taskService'
import { taskService } from '@/platform/tasks/services/taskService'
import type { AssetDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'

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

vi.mock(import('@/platform/tasks/services/taskService'), () => ({
  taskService: {
    getTask: vi.fn(),
    cancelTask: vi.fn()
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

    // OPEN DESIGN QUESTION (PM-1302 / PM-1309 both closed):
    // `activeDownloads` is also the UI's `isInProgress` signal (see
    // ModelImportProgressDialog.vue), and an existing, unmarked test above
    // ("moves download to finished when failed") requires a `failed` download
    // to leave `activeDownloads` so the dialog can show its failed state and
    // close button. Reconciliation of a `failed`-then-actually-`completed`
    // task is now handled separately (pollStaleDownloads() re-checks `failed`
    // downloads too, and a later WS message is no longer dropped - see the
    // test above), but deliberately without pulling `failed` downloads back
    // into `activeDownloads`, which would make the dialog show them as
    // in-progress again. Changing that UI-facing meaning of `activeDownloads`
    // is a product decision, not a mechanical fix, so this assertion is left
    // pinned as a known, deliberate gap for further discussion rather than
    // flipped.
    it.fails('excludes a failed-then-actually-completed task from activeDownloads (PM-1302)', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'running' }))
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )

      // The task never actually stopped on the backend - it retried and
      // completed - but it left activeDownloads the moment the premature
      // `failed` message landed, so the dialog stops showing it as in
      // progress. Reconciliation itself still happens: pollStaleDownloads()
      // walks recheckableDownloads, which includes `failed` (see the
      // polling test below).
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
  })

  describe('cancelDownload', () => {
    it('keeps an accepted cancellation provisional until the backend confirms it', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: true
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
        value: true
      })
      dispatch(createDownloadMessage({ status: 'created' }))

      await store.cancelDownload('task-123')

      expect(taskService.cancelTask).toHaveBeenCalledWith('task-123')
      expect(store.downloadList[0].status).toBe('cancellation_pending')
      expect(store.finishedDownloads).toHaveLength(0)
    })

    it('keeps the download active and allows retry when cancellation fails', async () => {
      const store = useAssetDownloadStore()
      const error = new Error('network')
      vi.mocked(taskService.cancelTask)
        .mockResolvedValueOnce({ ok: false, error })
        .mockResolvedValueOnce({ ok: true, value: true })
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

    it('keeps polling after the backend reports a terminal cancellation race', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: false
      })
      dispatch(createDownloadMessage({ status: 'running' }))

      await store.cancelDownload('task-123')

      expect(store.activeDownloads).toHaveLength(1)
    })

    it('allows an authoritative completion to replace confirmed cancellation', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: true
      })
      dispatch(createDownloadMessage({ status: 'running' }))
      await store.cancelDownload('task-123')

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('preserves a completion that arrives while cancellation is pending', async () => {
      const store = useAssetDownloadStore()
      let resolveCancellation!: (result: TaskResult<boolean>) => void
      vi.mocked(taskService.cancelTask).mockImplementation(
        () =>
          new Promise<TaskResult<boolean>>((resolve) => {
            resolveCancellation = resolve
          })
      )
      dispatch(createDownloadMessage({ status: 'running' }))

      const cancellation = store.cancelDownload('task-123')
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))
      resolveCancellation({ ok: true, value: true })
      await cancellation

      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('does not send duplicate cancellation requests while one is pending', async () => {
      const store = useAssetDownloadStore()
      let resolveCancellation!: (result: TaskResult<boolean>) => void
      vi.mocked(taskService.cancelTask).mockImplementation(
        () =>
          new Promise<TaskResult<boolean>>((resolve) => {
            resolveCancellation = resolve
          })
      )
      dispatch(createDownloadMessage({ status: 'running' }))

      const first = store.cancelDownload('task-123')
      const second = store.cancelDownload('task-123')
      expect(taskService.cancelTask).toHaveBeenCalledTimes(1)
      resolveCancellation({ ok: true, value: true })
      await Promise.all([first, second])
    })
  })

  describe('stale download polling', () => {
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
        value: true
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

    it('reconciles an authoritative failure after local cancellation and keeps polling', async () => {
      const store = useAssetDownloadStore()
      store.trackDownload('task-123', 'checkpoints', 'model.safetensors')
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: true
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

      await vi.advanceTimersByTimeAsync(10_000)

      expect(taskService.getTask).toHaveBeenCalledTimes(2)
      expect(store.finishedDownloads[0]).toMatchObject({
        status: 'completed',
        assetId: 'asset-456'
      })
    })

    it('preserves a provisional cancellation when finished downloads are cleared', async () => {
      const store = useAssetDownloadStore()
      vi.mocked(taskService.cancelTask).mockResolvedValue({
        ok: true,
        value: true
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
        value: true
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
  })

  describe('session download tracking', () => {
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
