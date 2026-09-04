import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getViewportInset,
  registerViewportInset
} from './viewportInsetRegistry'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

const disposers: Array<() => void> = []
function trackedRegister(
  ...args: Parameters<typeof registerViewportInset>
): ReturnType<typeof registerViewportInset> {
  const unregister = registerViewportInset(...args)
  disposers.push(unregister)
  return unregister
}

afterEach(() => {
  while (disposers.length) disposers.pop()!()
})

describe('viewportInsetRegistry', () => {
  it('defaults to zero without a registered provider', () => {
    expect(getViewportInset()).toBe(0)
  })

  it('sums registered providers and removes them independently', () => {
    const unregisterPanel = trackedRegister('test-panel', () => 320)
    const unregisterToolbar = trackedRegister('test-toolbar', () => 48)

    expect(getViewportInset()).toBe(368)

    unregisterPanel()
    expect(getViewportInset()).toBe(48)

    unregisterToolbar()
    expect(getViewportInset()).toBe(0)
  })

  it('clamps negative providers alone and alongside positive providers', () => {
    trackedRegister('test-negative', () => -100)

    expect(getViewportInset()).toBe(0)

    trackedRegister('test-positive', () => 48)
    expect(getViewportInset()).toBe(48)
  })

  it('does not let an obsolete disposer remove a replacement provider', () => {
    const unregisterOld = trackedRegister('test-replacement', () => 100)
    const unregisterCurrent = trackedRegister(
      'test-replacement',
      () => 240
    )

    unregisterOld()
    expect(getViewportInset()).toBe(240)

    unregisterCurrent()
    expect(getViewportInset()).toBe(0)
  })

  it('does not let a stale disposer remove a same-function replacement', () => {
    const provider = () => 160
    const unregisterOld = trackedRegister('test-same-provider', provider)
    const unregisterCurrent = trackedRegister(
      'test-same-provider',
      provider
    )

    unregisterOld()
    expect(getViewportInset()).toBe(160)

    unregisterCurrent()
    expect(getViewportInset()).toBe(0)
  })

  it('isolates a throwing provider from the rest of the aggregate', () => {
    trackedRegister('test-throws', () => {
      throw new Error('boom')
    })
    trackedRegister('test-fine', () => 48)

    expect(getViewportInset()).toBe(48)
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'viewport_inset_provider_failure'
    })
  })

  it('treats a NaN or Infinity provider as contributing zero', () => {
    trackedRegister('test-nan', () => NaN)
    trackedRegister('test-infinite', () => Infinity)
    trackedRegister('test-fine', () => 48)

    expect(getViewportInset()).toBe(48)
  })

  it('warns in dev when a live registration is replaced under the same key', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    trackedRegister('test-collision', () => 10)
    trackedRegister('test-collision', () => 20)

    expect(warnSpy).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })
})
