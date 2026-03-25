import * as Sentry from '@sentry/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWebSocketReconnectTracking } from './useWebSocketReconnectTracking'

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn()
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    activeJobsCount: mockActiveJobsCount
  })
}))

let mockActiveJobsCount = 0

describe('useWebSocketReconnectTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveJobsCount = 0
    setActivePinia(createPinia())
  })

  it('does nothing on reconnect without prior disconnect', () => {
    const { onReconnect } = useWebSocketReconnectTracking()
    onReconnect()
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('adds breadcrumb on reconnect after disconnect', () => {
    const { onDisconnect, onReconnect } = useWebSocketReconnectTracking()
    onDisconnect()
    onReconnect()

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'websocket',
        message: 'WebSocket reconnected',
        level: 'info'
      })
    )
  })

  it('captures warning when jobs were active at disconnect', () => {
    mockActiveJobsCount = 3
    const { onDisconnect, onReconnect } = useWebSocketReconnectTracking()
    onDisconnect()
    onReconnect()

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'WebSocket reconnected with active jobs',
      expect.objectContaining({
        level: 'warning',
        tags: { incident: 'incident-39' },
        extra: expect.objectContaining({ active_job_count: 3 })
      })
    )
  })

  it('does not capture warning when no jobs were active', () => {
    mockActiveJobsCount = 0
    const { onDisconnect, onReconnect } = useWebSocketReconnectTracking()
    onDisconnect()
    onReconnect()

    expect(Sentry.addBreadcrumb).toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('ignores duplicate disconnect calls', () => {
    mockActiveJobsCount = 2
    const { onDisconnect, onReconnect } = useWebSocketReconnectTracking()
    onDisconnect()

    // Job count changes between disconnect calls
    mockActiveJobsCount = 5
    onDisconnect()

    onReconnect()

    // Should use the count from the first disconnect (2), not the second (5)
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ active_job_count: 2 })
      })
    )
  })

  it('resets state and prevents stale reconnect', () => {
    const { onDisconnect, onReconnect, reset } = useWebSocketReconnectTracking()
    onDisconnect()
    reset()
    onReconnect()

    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
  })
})
