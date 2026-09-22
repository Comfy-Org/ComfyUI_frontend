import { beforeEach, describe, expect, it, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'
import type { AssetExportWsMessage } from '@/platform/remote/comfyui/execution/types'
import type { TaskResponse } from '@/platform/tasks/services/taskService'
import { taskService } from '@/platform/tasks/services/taskService'
import { api } from '@/scripts/api'
import { useAssetExportStore } from '@/stores/assetExportStore'

const taskId = '4d1453c1-ec17-4a50-b6a3-34d49ba1b09f'

vi.mock(import('@/platform/tasks/services/taskService'), () => ({
  taskService: { getTask: vi.fn() }
}))

function taskResponse(overrides: Partial<TaskResponse> = {}): TaskResponse {
  return {
    id: taskId,
    idempotency_key: 'export-assets',
    task_name: 'task:export_assets',
    payload: {},
    status: 'completed',
    result: { success: true },
    create_time: '2026-09-10T12:00:00.000Z',
    update_time: '2026-09-10T12:01:00.000Z',
    ...overrides
  }
}

function dispatchExport(overrides: Partial<AssetExportWsMessage> = {}) {
  api.dispatchCustomEvent('asset_export', {
    task_id: taskId,
    export_name: 'export.zip',
    assets_total: 3,
    assets_attempted: 1,
    assets_failed: 0,
    bytes_total: 100,
    bytes_processed: 25,
    progress: 0.25,
    status: 'running',
    ...overrides
  })
}

describe('useAssetExportStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('completes a stale task and requests its download URL', async () => {
    const store = useAssetExportStore()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const getExportDownloadUrl = vi
      .spyOn(assetService, 'getExportDownloadUrl')
      .mockResolvedValue({ url: 'https://example.com/export.zip' })
    vi.mocked(taskService.getTask).mockResolvedValue(taskResponse())
    dispatchExport()

    await vi.advanceTimersByTimeAsync(45_000)

    expect(taskService.getTask).toHaveBeenCalledWith(taskId)
    expect(store.activeExports).toHaveLength(0)
    expect(store.finishedExports[0]).toMatchObject({
      status: 'completed',
      exportName: 'export.zip',
      progress: 1
    })
    expect(getExportDownloadUrl).toHaveBeenCalledWith('export.zip')
  })

  it('keeps stale export metadata unchanged when polling rejects', async () => {
    const store = useAssetExportStore()
    vi.mocked(taskService.getTask).mockRejectedValue(new Error('offline'))
    dispatchExport()
    const beforePolling = { ...store.activeExports[0] }

    await vi.advanceTimersByTimeAsync(45_000)

    expect(taskService.getTask).toHaveBeenCalledWith(taskId)
    expect(store.activeExports).toEqual([beforePolling])
    expect(store.finishedExports).toHaveLength(0)
  })

  it('marks a repeatedly missing stale task as failed and stops polling it', async () => {
    const store = useAssetExportStore()
    const taskId = 'task-123'

    vi.mocked(taskService.getTask).mockResolvedValue(undefined)
    store.trackExport(taskId)

    await vi.advanceTimersByTimeAsync(45_000)

    expect(store.activeExports).toHaveLength(0)
    expect(store.finishedExports[0].status).toBe('failed')
    expect(taskService.getTask).toHaveBeenCalledTimes(3)

    dispatchExport({
      task_id: taskId,
      export_name: 'late.zip',
      assets_total: 1,
      assets_attempted: 1,
      bytes_total: 100,
      bytes_processed: 100,
      progress: 1,
      status: 'completed'
    })

    expect(store.finishedExports[0].status).toBe('failed')
  })

  it('accepts completion after a transient missing-task response', async () => {
    const store = useAssetExportStore()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(assetService, 'getExportDownloadUrl').mockResolvedValue({
      url: 'https://example.com/export.zip'
    })
    vi.mocked(taskService.getTask).mockResolvedValue(undefined)
    dispatchExport()

    await vi.advanceTimersByTimeAsync(10_000)
    dispatchExport({ status: 'completed', progress: 1 })

    expect(store.finishedExports[0].status).toBe('completed')
  })
})
