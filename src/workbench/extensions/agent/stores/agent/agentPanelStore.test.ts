import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const telemetry = vi.hoisted(() => ({
  trackAgentPanelOpened: vi.fn(),
  trackAgentPanelClosed: vi.fn()
}))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => telemetry
}))

import { useAgentPanelStore } from './agentPanelStore'

const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

describe('agentPanelStore engagement telemetry', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    useAgentPanelStore().$dispose()
    vi.useRealTimers()
  })

  it('emits a restored open only once the rehydrated panel actually docks', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useAgentPanelStore()

    expect(store.isOpen).toBe(true)
    await nextTick()
    expect(telemetry.trackAgentPanelOpened).not.toHaveBeenCalled()

    store.enabled = true
    await nextTick()
    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'restored'
    })

    vi.advanceTimersByTime(3000)
    store.close('close_button')
    expect(telemetry.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: 3000
    })
  })

  it('emits exactly one opened event for a user click while the panel is enabled', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    await nextTick()

    store.toggle()
    await nextTick()

    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'topbar_button'
    })
  })

  it('never emits for a rehydrated-open panel while the feature stays disabled', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    useAgentPanelStore()

    await nextTick()
    expect(telemetry.trackAgentPanelOpened).not.toHaveBeenCalled()
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

  it('ignores a redundant close so no duplicate telemetry fires', () => {
    const store = useAgentPanelStore()

    store.close('close_button')
    store.close('close_button')
    expect(telemetry.trackAgentPanelClosed).not.toHaveBeenCalled()
  })
})

describe('agentPanelStore open-state persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAgentPanelStore().$dispose()
  })

  it('persists the open state when the panel is toggled open', async () => {
    const store = useAgentPanelStore()

    store.toggle()
    await nextTick()

    expect(store.isOpen).toBe(true)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('true')
  })

  it('rehydrates isOpen from a pre-seeded stored value', () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')

    const store = useAgentPanelStore()

    expect(store.isOpen).toBe(true)
  })

  it('persists the closed state when the panel is closed', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useAgentPanelStore()

    store.close('close_button')
    await nextTick()

    expect(store.isOpen).toBe(false)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('false')
  })

  it('leaves the stored open state untouched when the panel is disabled', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useAgentPanelStore()

    store.enabled = false
    await nextTick()

    expect(store.isOpen).toBe(true)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('true')
  })
})
