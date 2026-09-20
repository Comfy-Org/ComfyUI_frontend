import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const telemetry = vi.hoisted(() => ({
  trackAgentPanelOpened: vi.fn(),
  trackAgentPanelClosed: vi.fn()
}))
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => telemetry
}))

import { useAgentPanelStore } from './agentPanelStore'

const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

function useConsentedAgentPanelStore() {
  const store = useAgentPanelStore()
  store.consentAccepted = true
  return store
}

describe('agentPanelStore engagement telemetry', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it('emits a restored open only once the rehydrated panel actually docks', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useConsentedAgentPanelStore()

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
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    await nextTick()

    store.toggle()
    await nextTick()

    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'topbar_button'
    })
  })

  it('starts a new visible interval after consent hides and restores the panel', async () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()
    await nextTick()
    vi.advanceTimersByTime(2000)

    store.consentAccepted = false
    await nextTick()
    expect(store.isOpen).toBe(true)
    vi.advanceTimersByTime(10000)
    store.consentAccepted = true
    await nextTick()
    vi.advanceTimersByTime(3000)
    store.close('close_button')

    expect(telemetry.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: 3000
    })
    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledTimes(2)
    expect(telemetry.trackAgentPanelOpened).toHaveBeenLastCalledWith({
      source: 'restored'
    })
  })

  it('attributes automatic consent to its own source without duplicate opens', async () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true

    store.open('automatic_consent')
    await nextTick()
    store.open('automatic_consent')

    expect(store.isVisible).toBe(true)
    expect(telemetry.trackAgentPanelOpened).toHaveBeenCalledExactlyOnceWith({
      source: 'automatic_consent'
    })
  })

  it('never emits for a rehydrated-open panel while the feature stays disabled', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    useAgentPanelStore()

    await nextTick()
    expect(telemetry.trackAgentPanelOpened).not.toHaveBeenCalled()
  })

  it('suppresses a restored open intent that has no consent', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useAgentPanelStore()
    store.enabled = true
    await nextTick()

    expect(store.isOpen).toBe(true)
    expect(store.isVisible).toBe(false)
    expect(telemetry.trackAgentPanelOpened).not.toHaveBeenCalled()

    store.suppressRestoredOpen()
    expect(store.isOpen).toBe(false)
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

describe('agentPanelStore discovery', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stays undiscovered while the panel has never docked', async () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    await nextTick()

    expect(store.hasEverOpened).toBe(false)
  })

  it('records discovery once the panel docks, and keeps it after a close', async () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()
    await nextTick()

    expect(store.hasEverOpened).toBe(true)

    store.close('topbar_button')
    await nextTick()

    expect(store.hasEverOpened).toBe(true)
  })

  it('records discovery for a panel restored from a previous visit', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    await nextTick()

    expect(store.hasEverOpened).toBe(true)
  })
})

describe('agentPanelStore open-state persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists the open state when the panel is toggled open', async () => {
    const store = useAgentPanelStore()

    store.toggle()
    await nextTick()

    expect(store.isOpen).toBe(true)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('true')
  })

  it('T-15 / PM-648 / FE-1284 restores the open panel state after refresh', () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')

    const store = useAgentPanelStore()

    expect(store.isOpen).toBe(true)
  })

  it('T-15 / PM-648 / FE-1284 preserves the closed panel state for refresh', async () => {
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

  it('starts unsettled and does not plant a storage key for flag-off users', () => {
    const store = useAgentPanelStore()

    expect(store.gateSettled).toBe(false)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBeNull()
  })
})

describe('agentPanelStore width', () => {
  /** Side toolbar rail + sidebar minimum. */
  const SIDEBAR_OPEN = 368
  /** Side toolbar rail alone, with no sidebar tab showing. */
  const SIDEBAR_CLOSED = 56

  function resizeWindowTo(px: number): void {
    window.innerWidth = px
    window.dispatchEvent(new Event('resize'))
  }

  beforeEach(() => {
    resizeWindowTo(1920)
  })

  it.for([
    {
      requested: 100,
      windowWidth: 1920,
      reserved: SIDEBAR_OPEN,
      expected: 420
    },
    {
      requested: 2000,
      windowWidth: 1920,
      reserved: SIDEBAR_OPEN,
      expected: 960
    },
    {
      requested: 700,
      windowWidth: 1920,
      reserved: SIDEBAR_OPEN,
      expected: 700
    },
    {
      requested: 2000,
      windowWidth: 1200,
      reserved: SIDEBAR_OPEN,
      expected: 832
    },
    {
      requested: 2000,
      windowWidth: 1200,
      reserved: SIDEBAR_CLOSED,
      expected: 960
    },
    {
      requested: 2000,
      windowWidth: 900,
      reserved: SIDEBAR_CLOSED,
      expected: 844
    },
    { requested: 2000, windowWidth: 700, reserved: SIDEBAR_OPEN, expected: 420 }
  ] as const)(
    'clamps a requested $requested to $expected in a $windowWidth window reserving $reserved',
    ({ requested, windowWidth, reserved, expected }) => {
      resizeWindowTo(windowWidth)
      const store = useAgentPanelStore()
      store.setReservedWorkspaceWidth(reserved)

      store.setWidth(requested)

      expect(store.width).toBe(expected)
    }
  )

  it('toggleMaximize flips width between the min and max bounds', () => {
    const store = useAgentPanelStore()
    expect(store.isMaximized).toBe(false)

    store.toggleMaximize()
    expect(store.width).toBe(960)
    expect(store.isMaximized).toBe(true)

    store.toggleMaximize()
    expect(store.width).toBe(420)
    expect(store.isMaximized).toBe(false)
  })

  it('shrinks a maximized panel to fit a narrowed window and restores it', () => {
    const store = useAgentPanelStore()
    store.toggleMaximize()

    resizeWindowTo(1200)
    expect(store.width).toBe(832)
    expect(store.isMaximized).toBe(true)

    resizeWindowTo(1920)
    expect(store.width).toBe(960)
  })

  it('gives a maximized panel the room back when the sidebar closes', () => {
    const store = useAgentPanelStore()
    store.toggleMaximize()
    resizeWindowTo(1200)
    expect(store.width).toBe(832)

    store.setReservedWorkspaceWidth(SIDEBAR_CLOSED)

    expect(store.width).toBe(960)
  })

  it('shrinks a panel that the opening sidebar would otherwise meet', () => {
    const store = useAgentPanelStore()
    store.setReservedWorkspaceWidth(SIDEBAR_CLOSED)
    resizeWindowTo(1200)
    store.setWidth(900)
    expect(store.width).toBe(900)

    store.setReservedWorkspaceWidth(SIDEBAR_OPEN)

    expect(store.width).toBe(832)
  })

  it('keeps the panel at its minimum width in a window too narrow to fit it', () => {
    const store = useAgentPanelStore()
    store.toggleMaximize()

    resizeWindowTo(600)

    expect(store.width).toBe(420)
  })

  it('drops the maximized state when the user drags the panel', () => {
    const store = useAgentPanelStore()
    store.toggleMaximize()

    store.setWidth(600)

    expect(store.isMaximized).toBe(false)
    expect(store.width).toBe(600)
  })
})
