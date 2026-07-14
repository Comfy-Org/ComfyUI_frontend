import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const telemetry = vi.hoisted(() => ({
  trackAgentPanelOpened: vi.fn(),
  trackAgentPanelClosed: vi.fn()
}))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => telemetry
}))

import { useAgentPanelStore } from './agentPanelStore'

describe('agentPanelStore engagement telemetry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits opened on toggle-open and closed with the open duration', () => {
    const store = useAgentPanelStore()

    store.toggle()
    expect(store.isOpen).toBe(true)
    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'topbar_button'
    })

    vi.advanceTimersByTime(5000)
    store.close('close_button')
    expect(store.isOpen).toBe(false)
    expect(telemetry.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: 5000
    })
  })

  it('toggling an open panel closes it attributed to the topbar button', () => {
    const store = useAgentPanelStore()

    store.toggle()
    vi.advanceTimersByTime(250)
    store.toggle()
    expect(telemetry.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'topbar_button',
      open_duration_ms: 250
    })
  })

  it('reports a null duration when the panel was opened by a direct state write', () => {
    const store = useAgentPanelStore()

    store.isOpen = true
    store.close('close_button')
    expect(telemetry.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: null
    })
  })

  it('ignores a close while already closed so flag re-syncs emit nothing', () => {
    const store = useAgentPanelStore()

    store.close('flag_disabled')
    store.close('flag_disabled')
    expect(telemetry.trackAgentPanelClosed).not.toHaveBeenCalled()
  })
})
