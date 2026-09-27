import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useTelemetry } from '@/platform/telemetry'

vi.mock(import('@/platform/telemetry'))

import { getAgentPanelOpen } from '@/platform/telemetry/utils/getAgentPanelOpen'

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
    expect(useTelemetry()!.trackAgentPanelOpened).not.toHaveBeenCalled()

    store.enabled = true
    await nextTick()
    expect(useTelemetry()!.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'restored'
    })

    vi.advanceTimersByTime(3000)
    store.close('close_button')
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledWith({
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

    expect(useTelemetry()!.trackAgentPanelOpened).toHaveBeenCalledTimes(1)
    expect(useTelemetry()!.trackAgentPanelOpened).toHaveBeenCalledWith({
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

    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: 3000
    })
    expect(useTelemetry()!.trackAgentPanelOpened).toHaveBeenCalledTimes(2)
    expect(useTelemetry()!.trackAgentPanelOpened).toHaveBeenLastCalledWith({
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
    expect(
      useTelemetry()!.trackAgentPanelOpened
    ).toHaveBeenCalledExactlyOnceWith({
      source: 'automatic_consent'
    })
  })

  it('never emits for a rehydrated-open panel while the feature stays disabled', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    useAgentPanelStore()

    await nextTick()
    expect(useTelemetry()!.trackAgentPanelOpened).not.toHaveBeenCalled()
  })

  it('suppresses a restored open intent that has no consent', async () => {
    localStorage.setItem(OPEN_STORAGE_KEY, 'true')
    const store = useAgentPanelStore()
    store.enabled = true
    await nextTick()

    expect(store.isOpen).toBe(true)
    expect(store.isVisible).toBe(false)
    expect(useTelemetry()!.trackAgentPanelOpened).not.toHaveBeenCalled()

    store.suppressRestoredOpen()
    expect(store.isOpen).toBe(false)
  })

  it('emits opened on toggle-open and closed with the open duration', () => {
    const store = useAgentPanelStore()

    store.toggle()
    expect(store.isOpen).toBe(true)
    expect(useTelemetry()!.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'topbar_button'
    })

    vi.advanceTimersByTime(5000)
    store.close('close_button')
    expect(store.isOpen).toBe(false)
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: 5000
    })
  })

  it('toggling an open panel closes it attributed to the topbar button', () => {
    const store = useAgentPanelStore()

    store.toggle()
    vi.advanceTimersByTime(250)
    store.toggle()
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'topbar_button',
      open_duration_ms: 250
    })
  })

  it('reports a null duration when the panel was opened by a direct state write', () => {
    const store = useAgentPanelStore()

    store.isOpen = true
    store.close('close_button')
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledWith({
      source: 'close_button',
      open_duration_ms: null
    })
  })

  it('ignores a redundant close so no duplicate telemetry fires', () => {
    const store = useAgentPanelStore()

    store.close('close_button')
    store.close('close_button')
    expect(useTelemetry()!.trackAgentPanelClosed).not.toHaveBeenCalled()
  })
})

describe('agentPanelStore pagehide teardown', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it('reports a pagehide close once while the panel is open, without touching persisted state', async () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()
    await nextTick()
    vi.advanceTimersByTime(4000)

    window.dispatchEvent(new Event('pagehide'))

    expect(
      useTelemetry()!.trackAgentPanelClosed
    ).toHaveBeenCalledExactlyOnceWith({
      source: 'pagehide',
      open_duration_ms: 4000
    })
    expect(store.isOpen).toBe(true)
    expect(localStorage.getItem(OPEN_STORAGE_KEY)).toBe('true')
  })

  it('does not double-report across a bfcache pagehide/resume/pagehide cycle', () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()

    window.dispatchEvent(new Event('pagehide'))
    // A bfcache restore resumes the same frozen JS heap: nothing in the store
    // changes, so the next pagehide (background again, or the real close)
    // must not re-report the same open interval.
    window.dispatchEvent(new Event('pagehide'))

    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledTimes(1)
  })

  function persistedPageshow(): Event {
    const event = new Event('pageshow')
    Object.defineProperty(event, 'persisted', { value: true })
    return event
  }

  it('starts a fresh interval on a persisted pageshow restore, so a later close only measures time since resume', () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()
    vi.advanceTimersByTime(4000)
    window.dispatchEvent(new Event('pagehide'))

    vi.advanceTimersByTime(10000)
    window.dispatchEvent(persistedPageshow())
    vi.advanceTimersByTime(2000)
    store.close('close_button')

    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledTimes(2)
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenNthCalledWith(1, {
      source: 'pagehide',
      open_duration_ms: 4000
    })
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenNthCalledWith(2, {
      source: 'close_button',
      open_duration_ms: 2000
    })
  })

  it('can report pagehide again after a persisted pageshow resume', () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()
    window.dispatchEvent(new Event('pagehide'))

    window.dispatchEvent(persistedPageshow())
    vi.advanceTimersByTime(1500)
    window.dispatchEvent(new Event('pagehide'))

    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenCalledTimes(2)
    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenNthCalledWith(2, {
      source: 'pagehide',
      open_duration_ms: 1500
    })
  })

  it('ignores a non-persisted pageshow (a normal load, not a bfcache restore)', () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()
    vi.advanceTimersByTime(4000)
    window.dispatchEvent(new Event('pagehide'))

    vi.advanceTimersByTime(10000)
    window.dispatchEvent(new Event('pageshow'))
    vi.advanceTimersByTime(2000)
    store.close('close_button')

    expect(useTelemetry()!.trackAgentPanelClosed).toHaveBeenNthCalledWith(2, {
      source: 'close_button',
      open_duration_ms: 16000
    })
  })

  it('does not report a pagehide close while the panel is not open', () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true

    window.dispatchEvent(new Event('pagehide'))

    expect(useTelemetry()!.trackAgentPanelClosed).not.toHaveBeenCalled()
  })

  it('does not report a pagehide close for an open panel gated behind consent', () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.open()

    window.dispatchEvent(new Event('pagehide'))

    expect(useTelemetry()!.trackAgentPanelClosed).not.toHaveBeenCalled()
  })

  it('can report again for a fresh open session after a prior pagehide report', () => {
    const store = useConsentedAgentPanelStore()
    store.enabled = true
    store.open()
    window.dispatchEvent(new Event('pagehide'))
    store.close('close_button')

    store.open()
    vi.advanceTimersByTime(1000)
    window.dispatchEvent(new Event('pagehide'))

    const pagehideCalls = vi
      .mocked(useTelemetry())!
      .trackAgentPanelClosed.mock.calls.filter(
        ([metadata]) => metadata.source === 'pagehide'
      )
    expect(pagehideCalls).toHaveLength(2)
    expect(pagehideCalls[1][0]).toEqual({
      source: 'pagehide',
      open_duration_ms: 1000
    })
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
    { requested: 2000, windowWidth: 700, reserved: SIDEBAR_OPEN, expected: 332 }
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

  it('follows a window too narrow for the panel minimum instead of leaving it', () => {
    const store = useAgentPanelStore()
    store.toggleMaximize()

    resizeWindowTo(600)

    expect(store.width).toBe(232)
  })

  it('restores the dragged width once the window has room for it again', () => {
    const store = useAgentPanelStore()
    resizeWindowTo(1000)

    store.setWidth(900)
    expect(store.width).toBe(632)

    resizeWindowTo(1400)
    expect(store.width).toBe(900)
  })

  it('drops the maximized state when the user drags the panel', () => {
    const store = useAgentPanelStore()
    store.toggleMaximize()

    store.setWidth(600)

    expect(store.isMaximized).toBe(false)
    expect(store.width).toBe(600)
  })

  // `getAgentPanelOpen` powers the agent_panel_open run-attribution flag. It
  // cannot import this store (platform/ may not import workbench/), so it reads
  // OPEN_STORAGE_KEY directly. Renaming the key here without updating that util
  // would silently pin the flag to false, so pin the pairing from this side.
  it('persists isOpen where the run-attribution flag reads it', async () => {
    const store = useAgentPanelStore()

    store.open()
    await nextTick()
    expect(getAgentPanelOpen()).toBe(true)

    store.close('topbar_button')
    await nextTick()
    expect(getAgentPanelOpen()).toBe(false)
  })
})
