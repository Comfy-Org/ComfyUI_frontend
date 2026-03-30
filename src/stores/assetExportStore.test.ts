import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'
import type { AssetExportWsMessage } from '@/schemas/apiSchema'
import { useAssetExportStore } from '@/stores/assetExportStore'

type ExportEventHandler = (e: CustomEvent<AssetExportWsMessage>) => void

const eventHandler = vi.hoisted(() => {
  const state: { current: ExportEventHandler | null } = { current: null }
  return state
})

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn((_event: string, handler: ExportEventHandler) => {
      eventHandler.current = handler
    }),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getExportDownloadUrl: vi.fn()
  }
}))

vi.mock('@/platform/tasks/services/taskService', () => ({
  taskService: {
    getTask: vi.fn()
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: vi.fn() })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

function createExportMessage(
  overrides: Partial<AssetExportWsMessage> = {}
): AssetExportWsMessage {
  return {
    task_id: 'task-123',
    assets_total: 5,
    assets_attempted: 0,
    assets_failed: 0,
    bytes_total: 1000,
    bytes_processed: 0,
    progress: 0,
    status: 'running',
    ...overrides
  }
}

function dispatch(data: AssetExportWsMessage) {
  if (!eventHandler.current) {
    throw new Error(
      'Event handler not registered. Call useAssetExportStore() first.'
    )
  }
  eventHandler.current(new CustomEvent('asset_export', { detail: data }))
}

describe('useAssetExportStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.clearAllMocks()
    eventHandler.current = null
    vi.mocked(assetService.getExportDownloadUrl).mockResolvedValue({
      url: 'https://example.com/export.zip'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('handleAssetExport', () => {
    it('ignores messages for exports not tracked by this tab', () => {
      const store = useAssetExportStore()

      dispatch(
        createExportMessage({
          status: 'completed',
          export_name: 'export.zip',
          progress: 1
        })
      )

      expect(store.exportList).toHaveLength(0)
      expect(assetService.getExportDownloadUrl).not.toHaveBeenCalled()
    })

    it('updates tracked exports on progress messages', () => {
      const store = useAssetExportStore()
      store.trackExport('task-123')

      dispatch(
        createExportMessage({
          assets_attempted: 3,
          bytes_processed: 500,
          progress: 0.5
        })
      )

      expect(store.activeExports).toHaveLength(1)
      expect(store.activeExports[0].progress).toBe(0.5)
      expect(store.activeExports[0].assetsAttempted).toBe(3)
    })

    it('moves export to finished on completion', () => {
      const store = useAssetExportStore()
      store.trackExport('task-123')

      dispatch(createExportMessage({ status: 'running' }))
      expect(store.activeExports).toHaveLength(1)

      dispatch(
        createExportMessage({
          status: 'completed',
          export_name: 'export.zip',
          progress: 1
        })
      )

      expect(store.activeExports).toHaveLength(0)
      expect(store.finishedExports).toHaveLength(1)
      expect(store.finishedExports[0].status).toBe('completed')
      expect(assetService.getExportDownloadUrl).toHaveBeenCalledTimes(1)
    })

    it('ignores duplicate completed messages after download triggered', () => {
      const store = useAssetExportStore()
      store.trackExport('task-123')

      dispatch(
        createExportMessage({
          status: 'completed',
          export_name: 'export.zip',
          progress: 1
        })
      )

      const before = store.finishedExports.length
      dispatch(
        createExportMessage({
          status: 'completed',
          export_name: 'export.zip',
          progress: 1
        })
      )

      expect(store.finishedExports).toHaveLength(before)
      expect(assetService.getExportDownloadUrl).toHaveBeenCalledTimes(1)
    })
  })

  describe('trackExport', () => {
    it('creates an initial export entry', () => {
      const store = useAssetExportStore()
      store.trackExport('task-abc')

      expect(store.hasActiveExports).toBe(true)
      expect(store.activeExports[0].taskId).toBe('task-abc')
      expect(store.activeExports[0].status).toBe('created')
      expect(store.activeExports[0].downloadTriggered).toBe(false)
    })

    it('does not duplicate if already tracked', () => {
      const store = useAssetExportStore()
      store.trackExport('task-abc')
      store.trackExport('task-abc')

      expect(store.exportList).toHaveLength(1)
    })
  })

  describe('clearFinishedExports', () => {
    it('removes all finished exports', () => {
      const store = useAssetExportStore()
      store.trackExport('task-123')

      dispatch(
        createExportMessage({
          status: 'completed',
          export_name: 'export.zip',
          progress: 1
        })
      )
      expect(store.finishedExports).toHaveLength(1)

      store.clearFinishedExports()
      expect(store.finishedExports).toHaveLength(0)
    })
  })
})
