import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'
import type { TaskResponse } from '@/platform/tasks/services/taskService'
import type { AssetExportWsMessage } from '@/platform/remote/comfyui/execution/types'
import { api } from '@/scripts/api'
import { useAssetExportStore } from '@/stores/assetExportStore'

type ExportEventHandler = (e: CustomEvent<unknown>) => void

const eventHandler = vi.hoisted(() => {
  const state: { current: ExportEventHandler | null } = { current: null }
  return state
})

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    api_base: '/comfy',
    apiURL: vi.fn((route: string) => `/comfy${route}`),
    fetchApi: vi.fn(),
    addEventListener: vi.fn((_event: string, handler: ExportEventHandler) => {
      eventHandler.current = handler
    }),
    removeEventListener: vi.fn()
  }
}))

vi.mock<unknown>(import('@/platform/assets/services/assetService'), () => ({
  assetService: {
    getExportDownloadUrl: vi.fn().mockResolvedValue({ url: '/export.zip' })
  }
}))

vi.mock<unknown>(import('@/i18n'), () => ({
  t: (key: string) => key
}))

/**
 * `taskService` is deliberately real here. Narrowing the shared `/tasks`
 * response's `result` to one task type's shape is exactly the defect these
 * tests pin, so the schema has to be in the path under test.
 */
function createExportTaskResponse(
  overrides: Partial<TaskResponse> = {}
): TaskResponse {
  return {
    id: '1396cc07-bab2-4f12-9b54-741f83f9224c',
    idempotency_key: 'key-export',
    task_name: 'task:export_assets',
    payload: {},
    status: 'completed',
    create_time: new Date().toISOString(),
    update_time: new Date().toISOString(),
    result: {
      export_name: 'bundle.zip',
      assets_total: 3,
      assets_attempted: 3,
      assets_failed: 0
    },
    ...overrides
  }
}

function createExportMessage(
  overrides: Partial<AssetExportWsMessage> = {}
): AssetExportWsMessage {
  return {
    task_id: '1396cc07-bab2-4f12-9b54-741f83f9224c',
    export_name: 'bundle.zip',
    assets_total: 3,
    assets_attempted: 1,
    assets_failed: 0,
    bytes_total: 1000,
    bytes_processed: 300,
    progress: 0.3,
    status: 'running',
    ...overrides
  }
}

function dispatch(msg: AssetExportWsMessage) {
  dispatchUnknown(msg)
}

function dispatchUnknown(msg: unknown) {
  if (!eventHandler.current) {
    throw new Error('Event handler not registered. Call the store factory.')
  }
  eventHandler.current(new CustomEvent('asset_export', { detail: msg }))
}

describe('useAssetExportStore polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    eventHandler.current = null
  })

  it('reconciles an export from a task result of its own shape', async () => {
    const store = useAssetExportStore()
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(createExportTaskResponse())
    )
    dispatch(createExportMessage())

    await vi.advanceTimersByTimeAsync(10_000)

    expect(store.finishedExports[0]).toMatchObject({
      status: 'completed',
      exportName: 'bundle.zip',
      assetsTotal: 3
    })
  })

  it('finishes an export the backend reports as cancelled', async () => {
    const store = useAssetExportStore()
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(
        createExportTaskResponse({ status: 'cancelled', result: undefined })
      )
    )
    dispatch(createExportMessage())
    expect(store.activeExports).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(10_000)

    // A cancelled export has to reach a finished status, or it is polled for
    // the life of the page and `clearFinishedExports` can never remove it.
    expect(store.activeExports).toHaveLength(0)
    expect(store.finishedExports[0].status).toBe('cancelled')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.fetchApi).toHaveBeenCalledTimes(1)

    store.clearFinishedExports()
    expect(store.hasExports).toBe(false)
  })

  it('does not revive a cancelled export from a stale progress message', async () => {
    const store = useAssetExportStore()
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(
        createExportTaskResponse({ status: 'cancelled', result: undefined })
      )
    )
    dispatch(createExportMessage())
    await vi.advanceTimersByTimeAsync(10_000)
    expect(store.finishedExports[0].status).toBe('cancelled')

    dispatch(createExportMessage({ status: 'running', progress: 0.6 }))

    expect(store.finishedExports[0].status).toBe('cancelled')
    expect(store.activeExports).toHaveLength(0)
  })

  it('settles an existing export that receives an unknown wire status', () => {
    const store = useAssetExportStore()
    dispatch(createExportMessage())

    dispatchUnknown({ ...createExportMessage(), status: 'future-status' })

    expect(store.finishedExports[0]).toMatchObject({
      status: 'failed',
      error: 'Unknown task status: future-status'
    })
  })

  it.for(['completed', 'cancelled'] as const)(
    'preserves a terminal %s export after an unknown wire status',
    (status) => {
      const store = useAssetExportStore()
      store.trackExport('task-1')
      dispatch(
        createExportMessage({
          task_id: 'task-1',
          status,
          progress: status === 'completed' ? 1 : 0.3
        })
      )

      dispatchUnknown({
        ...createExportMessage({ task_id: 'task-1' }),
        status: 'future-status'
      })

      expect(store.exportList[0].status).toBe(status)
      expect(store.exportList[0].error).toBeUndefined()
    }
  )

  it('settles an export when its task row has been purged', async () => {
    const store = useAssetExportStore()
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 404 })
    )
    dispatch(createExportMessage())

    await vi.advanceTimersByTimeAsync(10_000)

    expect(store.activeExports).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(store.finishedExports[0]).toMatchObject({
      status: 'failed',
      error: 'progressToast.failed'
    })
  })

  it('keeps completion terminal when fetching the download URL fails', async () => {
    const store = useAssetExportStore()
    vi.mocked(assetService.getExportDownloadUrl).mockRejectedValueOnce(
      new Error('signed URL failed')
    )
    dispatch(createExportMessage({ status: 'completed', progress: 1 }))
    await vi.advanceTimersByTimeAsync(0)

    dispatch(createExportMessage({ status: 'running', progress: 0.5 }))

    expect(store.finishedExports[0]).toMatchObject({
      status: 'completed',
      downloadError: 'signed URL failed'
    })
    expect(store.activeExports).toHaveLength(0)
  })

  it('does not restore a dismissed export when an in-flight poll finishes', async () => {
    const store = useAssetExportStore()
    let releaseResponse!: () => void
    const responseReady = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    vi.mocked(api.fetchApi).mockImplementation(async () => {
      await responseReady
      return Response.json(createExportTaskResponse())
    })

    dispatch(createExportMessage())
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.fetchApi).toHaveBeenCalled()

    // The export completes and the user dismisses the toast while the poll
    // started above is still in flight.
    dispatch(createExportMessage({ status: 'completed', progress: 1 }))
    await vi.advanceTimersByTimeAsync(0)
    expect(assetService.getExportDownloadUrl).toHaveBeenCalledTimes(1)
    store.clearFinishedExports()
    expect(store.hasExports).toBe(false)

    releaseResponse()
    await vi.advanceTimersByTimeAsync(0)

    // Without an identity guard the resolved poll re-inserts the export with
    // `downloadTriggered` false and downloads the archive a second time.
    expect(store.hasExports).toBe(false)
    expect(assetService.getExportDownloadUrl).toHaveBeenCalledTimes(1)
  })

  it('does not overlap slow polling requests for one export', async () => {
    useAssetExportStore()
    let releaseResponse!: () => void
    const responseReady = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    vi.mocked(api.fetchApi).mockImplementation(async () => {
      await responseReady
      return Response.json(
        createExportTaskResponse({ status: 'running', result: undefined })
      )
    })
    dispatch(createExportMessage())

    await vi.advanceTimersByTimeAsync(30_000)

    expect(api.fetchApi).toHaveBeenCalledTimes(1)

    releaseResponse()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })
})

describe('assetExportStore triggerDownload', () => {
  it.for([
    {
      name: 'a server-relative URL under the API base',
      url: '/api/view?filename=e.zip&type=temp&subfolder=exports',
      expected:
        'http://localhost:3000/comfy/api/view?filename=e.zip&type=temp&subfolder=exports'
    },
    {
      name: 'an absolute signed URL unchanged',
      url: 'https://storage.example.com/exports/e.zip?signature=abc',
      expected: 'https://storage.example.com/exports/e.zip?signature=abc'
    },
    {
      name: 'a protocol-relative signed URL unchanged',
      url: '//storage.example.com/exports/e.zip?signature=abc',
      expected: 'http://storage.example.com/exports/e.zip?signature=abc'
    }
  ])('downloads $name', async ({ url, expected }) => {
    const originalBase = api.api_base
    api.api_base = '/comfy'
    onTestFinished(() => {
      api.api_base = originalBase
    })
    vi.mocked(assetService.getExportDownloadUrl).mockResolvedValue({ url })
    const clickedHrefs: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clickedHrefs.push(this.href)
      }
    )
    const store = useAssetExportStore()
    store.trackExport('task-1')
    const [exportJob] = store.exportList
    exportJob.exportName = 'e.zip'

    await store.triggerDownload(exportJob)

    expect(clickedHrefs).toEqual([expected])
  })

  it('rejects non-HTTP download URLs', async () => {
    vi.mocked(assetService.getExportDownloadUrl).mockResolvedValue({
      url: 'javascript:alert(1)'
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const store = useAssetExportStore()
    store.trackExport('task-1')
    store.exportList[0].exportName = 'e.zip'

    await store.triggerDownload(store.exportList[0])

    expect(click).not.toHaveBeenCalled()
    expect(store.exportList[0].downloadError).toBe(
      'Unsupported export download URL'
    )
  })
})
