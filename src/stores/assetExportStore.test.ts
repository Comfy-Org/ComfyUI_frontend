import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as VueUse from '@vueuse/core'

import type { AssetExportWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import type { TaskId } from '@/platform/tasks/services/taskService'
import { useAssetExportStore } from '@/stores/assetExportStore'

const { getExportDownloadUrl, getTask, toastAdd, intervalState } = vi.hoisted(
  () => ({
    getExportDownloadUrl: vi.fn(),
    getTask: vi.fn(),
    toastAdd: vi.fn(),
    intervalState: { cb: null as null | (() => void) }
  })
)

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof VueUse>()),
  useIntervalFn: (cb: () => void) => {
    intervalState.cb = cb
    return { pause: vi.fn(), resume: vi.fn() }
  }
}))

vi.mock('@/scripts/api', () => ({
  api: { addEventListener: vi.fn() }
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: { getExportDownloadUrl }
}))

vi.mock('@/platform/tasks/services/taskService', () => ({
  taskService: { getTask }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

function wsMessage(
  over: Partial<AssetExportWsMessage> = {}
): AssetExportWsMessage {
  return {
    task_id: 'task-1',
    export_name: 'export.zip',
    assets_total: 10,
    assets_attempted: 5,
    assets_failed: 0,
    bytes_total: 1000,
    bytes_processed: 500,
    progress: 0.5,
    status: 'running',
    ...over
  }
}

const taskId = (id: string) => id as TaskId

/**
 * Build a store and an `emit` bound to the real `asset_export` listener the
 * store registers on `api`, so tests drive the state machine through its
 * actual entry point rather than a private method.
 */
function setup() {
  const store = useAssetExportStore()
  const entry = vi
    .mocked(api.addEventListener)
    .mock.calls.find((c) => c[0] === 'asset_export')
  const handler = entry![1] as (e: { detail: AssetExportWsMessage }) => void
  const emit = (msg: AssetExportWsMessage) => handler({ detail: msg })
  // Run the polling tick that `useIntervalFn` would normally fire, and let its
  // async work settle.
  const runPoll = async () => {
    intervalState.cb?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { store, emit, runPoll }
}

const STALE_AGO_MS = 20_000

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(api.addEventListener).mockClear()
  getExportDownloadUrl
    .mockReset()
    .mockResolvedValue({ url: 'https://example.com/export.zip' })
  getTask.mockReset()
  toastAdd.mockReset()
})

describe('assetExportStore', () => {
  it('tracks a new export as created and is idempotent', () => {
    const { store } = setup()

    store.trackExport(taskId('t1'))
    store.trackExport(taskId('t1'))

    expect(store.exportList).toHaveLength(1)
    expect(store.exportList[0].status).toBe('created')
    expect(store.hasExports).toBe(true)
    expect(store.hasActiveExports).toBe(true)
  })

  it('separates active from finished exports by status', () => {
    const { store, emit } = setup()

    emit(wsMessage({ task_id: 'running', status: 'running' }))
    emit(
      wsMessage({ task_id: 'failed', status: 'failed', export_name: 'f.zip' })
    )

    expect(store.activeExports.map((e) => e.taskId)).toEqual(['running'])
    expect(store.finishedExports.map((e) => e.taskId)).toEqual(['failed'])
  })

  it('updates an export from successive websocket messages', () => {
    const { store, emit } = setup()

    emit(wsMessage({ progress: 0.5, status: 'running' }))
    emit(wsMessage({ progress: 0.9, status: 'running' }))

    expect(store.exportList).toHaveLength(1)
    expect(store.exportList[0].progress).toBe(0.9)
  })

  it('ignores updates for an export already completed and downloaded', async () => {
    const { store, emit } = setup()

    emit(wsMessage({ status: 'completed' }))
    await Promise.resolve()
    const triggeredCalls = getExportDownloadUrl.mock.calls.length

    // A late 'running' message must not revive a completed+downloaded export
    emit(wsMessage({ status: 'running', progress: 0.1 }))

    expect(store.exportList[0].status).toBe('completed')
    expect(getExportDownloadUrl).toHaveBeenCalledTimes(triggeredCalls)
  })

  it('falls back to the prior export name when a message omits it', async () => {
    const { store, emit } = setup()

    emit(wsMessage({ status: 'running', progress: 0.4 }))
    emit(
      wsMessage({ status: 'running', export_name: undefined, progress: 0.6 })
    )

    expect(store.exportList[0].exportName).toBe('export.zip')
  })

  it('triggers a download for a named export and clears prior errors', async () => {
    const { store, emit } = setup()
    emit(wsMessage({ status: 'running' }))
    const [exp] = store.exportList

    await store.triggerDownload(exp)

    expect(getExportDownloadUrl).toHaveBeenCalledWith('export.zip')
    expect(exp.downloadTriggered).toBe(true)
    expect(exp.downloadError).toBeUndefined()
  })

  it('does not re-trigger a download unless forced', async () => {
    const { store, emit } = setup()
    emit(wsMessage({ status: 'running' }))
    const [exp] = store.exportList
    exp.downloadTriggered = true

    await store.triggerDownload(exp)
    expect(getExportDownloadUrl).not.toHaveBeenCalled()

    await store.triggerDownload(exp, true)
    expect(getExportDownloadUrl).toHaveBeenCalledTimes(1)
  })

  it('records a download error and surfaces a toast on failure', async () => {
    getExportDownloadUrl.mockRejectedValueOnce(new Error('network down'))
    const { store, emit } = setup()
    emit(wsMessage({ status: 'running' }))
    const [exp] = store.exportList

    await store.triggerDownload(exp)

    expect(exp.downloadError).toBe('network down')
    expect(exp.downloadTriggered).toBe(false)
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('clears finished exports while keeping active ones', () => {
    const { store, emit } = setup()
    emit(wsMessage({ task_id: 'a', status: 'running' }))
    emit(wsMessage({ task_id: 'b', status: 'failed', export_name: 'b.zip' }))

    store.clearFinishedExports()

    expect(store.exportList.map((e) => e.taskId)).toEqual(['a'])
  })

  it('does not poll when no active export is stale', async () => {
    const { emit, runPoll } = setup()
    emit(wsMessage({ status: 'running' }))

    await runPoll()

    expect(getTask).not.toHaveBeenCalled()
  })

  it('reconciles a stale export from the task service result', async () => {
    const { store, emit, runPoll } = setup()
    emit(wsMessage({ status: 'running' }))
    store.exportList[0].lastUpdate = Date.now() - STALE_AGO_MS
    getTask.mockResolvedValue({
      status: 'completed',
      result: { export_name: 'reconciled.zip', assets_total: 10 }
    })

    await runPoll()

    expect(getTask).toHaveBeenCalledWith('task-1')
    expect(store.exportList[0].status).toBe('completed')
    expect(store.exportList[0].exportName).toBe('reconciled.zip')
  })

  it('leaves a stale export untouched when the task lookup fails', async () => {
    const { store, emit, runPoll } = setup()
    emit(wsMessage({ status: 'running' }))
    store.exportList[0].lastUpdate = Date.now() - STALE_AGO_MS
    getTask.mockRejectedValue(new Error('task not found'))

    await runPoll()

    expect(store.exportList[0].status).toBe('running')
  })
})
