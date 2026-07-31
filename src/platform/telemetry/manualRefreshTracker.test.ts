import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  addAction: vi.fn(),
  getInternalContext: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: hoisted
}))

import { trackUserManualRefresh } from './manualRefreshTracker'

function mockNavigationType(type: string): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
    { type } as PerformanceNavigationTiming
  ])
}

describe('trackUserManualRefresh', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    hoisted.getInternalContext.mockReturnValue({ session_id: 'session-1' })
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('counts reloads within the same session', () => {
    mockNavigationType('reload')

    trackUserManualRefresh()
    trackUserManualRefresh()

    expect(hoisted.addAction.mock.calls).toEqual([
      ['user_manual_refresh', { refresh_count: 1 }],
      ['user_manual_refresh', { refresh_count: 2 }]
    ])
  })

  it('restarts the count for a new session', () => {
    mockNavigationType('reload')

    trackUserManualRefresh()
    hoisted.getInternalContext.mockReturnValue({ session_id: 'session-2' })
    trackUserManualRefresh()

    expect(hoisted.addAction).toHaveBeenLastCalledWith('user_manual_refresh', {
      refresh_count: 1
    })
  })

  it('ignores a non-reload navigation', () => {
    mockNavigationType('navigate')

    trackUserManualRefresh()

    expect(hoisted.addAction).not.toHaveBeenCalled()
  })
})
