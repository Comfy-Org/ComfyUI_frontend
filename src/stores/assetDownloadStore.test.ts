import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'
import type { TaskResponse } from '@/platform/tasks/services/taskService'
import { taskService } from '@/platform/tasks/services/taskService'
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
    getTask: vi.fn()
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

      vi.mocked(taskService.getTask).mockResolvedValue(createTaskResponse())

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
      vi.mocked(taskService.getTask).mockResolvedValue(createTaskResponse())
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

    it('does not restore a dismissed failed download when an in-flight poll finishes', async () => {
      const store = useAssetDownloadStore()
      let resolveResponse!: (value: TaskResponse) => void
      const response = new Promise<TaskResponse>((resolve) => {
        resolveResponse = resolve
      })
      vi.mocked(taskService.getTask).mockReturnValue(response)
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )
      await vi.advanceTimersByTimeAsync(10_000)
      expect(taskService.getTask).toHaveBeenCalledWith('task-123')

      store.clearFinishedDownloads()
      resolveResponse(createTaskResponse({ status: 'failed' }))
      await vi.advanceTimersByTimeAsync(0)

      expect(store.hasDownloads).toBe(false)
    })

    it('polls and marks failed downloads', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(taskService.getTask).mockResolvedValue(
        createTaskResponse({
          status: 'failed',
          error_message: 'Download failed',
          result: { success: false, error: 'Network error' }
        })
      )

      dispatch(createDownloadMessage({ status: 'running' }))
      await vi.advanceTimersByTimeAsync(45_000)

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads[0].status).toBe('failed')
      expect(store.finishedDownloads[0].error).toBe('Download failed')
    })

    it('does not complete if task still running', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(taskService.getTask).mockResolvedValue(
        createTaskResponse({ status: 'running', result: undefined })
      )

      dispatch(createDownloadMessage({ status: 'running' }))
      await vi.advanceTimersByTimeAsync(45_000)

      expect(taskService.getTask).toHaveBeenCalled()
      expect(store.activeDownloads).toHaveLength(1)
    })

    it('continues tracking on polling error', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(taskService.getTask).mockRejectedValue(new Error('Not found'))
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
