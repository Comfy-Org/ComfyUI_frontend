import { beforeEach, describe, expect, it, vi } from 'vitest'

import { taskService } from '@/platform/tasks/services/taskService'
import type { AssetExportWsMessage } from '@/schemas/apiSchema'
import { useAssetExportStore } from '@/stores/assetExportStore'

type ExportEventHandler = (event: CustomEvent<AssetExportWsMessage>) => void

const eventHandler = vi.hoisted(() => {
  const state: { current: ExportEventHandler | null } = { current: null }
  return state
})

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn((_event: string, handler: ExportEventHandler) => {
      eventHandler.current = handler
    })
  }
}))

vi.mock('@/platform/tasks/services/taskService', () => ({
  taskService: { getTask: vi.fn() }
}))

describe('useAssetExportStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    eventHandler.current = null
  })

  it('marks a missing stale task as failed and stops polling it', async () => {
    const store = useAssetExportStore()
    const taskId = 'task-123'

    vi.mocked(taskService.getTask).mockResolvedValue(undefined)
    store.trackExport(taskId)

    await vi.advanceTimersByTimeAsync(45_000)

    expect(store.activeExports).toHaveLength(0)
    expect(store.finishedExports[0].status).toBe('failed')
    expect(taskService.getTask).toHaveBeenCalledTimes(1)
  })
})
