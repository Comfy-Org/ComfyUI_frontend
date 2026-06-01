import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { effectScope, nextTick, ref } from 'vue'

import type { AppMode } from './useAppMode'

const hoisted = vi.hoisted(() => ({
  telemetry: null as { trackModeTimeSpent: ReturnType<typeof vi.fn> } | null,
  mode: null as unknown as Ref<AppMode>
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => hoisted.telemetry
}))

vi.mock('./useAppMode', () => ({
  useAppMode: () => ({ mode: hoisted.mode })
}))

import { useModeTimeTracking } from './useModeTimeTracking'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useModeTimeTracking', () => {
  let scope: ReturnType<typeof effectScope>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    hoisted.telemetry = { trackModeTimeSpent: vi.fn() }
    hoisted.mode = ref<AppMode>('graph')
    setVisibility('visible')
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  const track = () => hoisted.telemetry!.trackModeTimeSpent

  it('emits the elapsed seconds for the previous mode on mode change', async () => {
    scope.run(() => useModeTimeTracking())

    vi.setSystemTime(5000)
    hoisted.mode.value = 'app'
    await nextTick()

    expect(track()).toHaveBeenCalledWith({
      mode: 'graph',
      duration_seconds: 5
    })
  })

  it('excludes time while the tab is hidden', async () => {
    hoisted.mode = ref<AppMode>('app')
    scope.run(() => useModeTimeTracking())

    vi.setSystemTime(2000)
    setVisibility('hidden')
    expect(track()).toHaveBeenCalledWith({ mode: 'app', duration_seconds: 2 })

    track().mockClear()
    vi.setSystemTime(10_000)
    setVisibility('visible')
    vi.setSystemTime(11_000)

    hoisted.mode.value = 'graph'
    await nextTick()

    expect(track()).toHaveBeenCalledTimes(1)
    expect(track()).toHaveBeenCalledWith({ mode: 'app', duration_seconds: 1 })
  })

  it('does not emit sub-second durations', async () => {
    scope.run(() => useModeTimeTracking())

    vi.setSystemTime(300)
    hoisted.mode.value = 'app'
    await nextTick()

    expect(track()).not.toHaveBeenCalled()
  })

  it('flushes the final mode when the scope is disposed', () => {
    hoisted.mode = ref<AppMode>('app')
    scope.run(() => useModeTimeTracking())

    vi.setSystemTime(3000)
    scope.stop()

    expect(track()).toHaveBeenCalledWith({ mode: 'app', duration_seconds: 3 })
  })

  it('no-ops without a telemetry provider', async () => {
    hoisted.telemetry = null
    expect(() => scope.run(() => useModeTimeTracking())).not.toThrow()

    vi.setSystemTime(5000)
    hoisted.mode.value = 'app'
    await expect(nextTick()).resolves.not.toThrow()
  })
})
