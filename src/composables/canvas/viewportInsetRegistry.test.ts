import { describe, expect, it } from 'vitest'

import {
  getViewportInset,
  registerViewportInset
} from './viewportInsetRegistry'

describe('viewportInsetRegistry', () => {
  it('defaults to zero without a registered provider', () => {
    expect(getViewportInset()).toBe(0)
  })

  it('sums registered providers and removes them independently', () => {
    const unregisterPanel = registerViewportInset('test-panel', () => 320)
    const unregisterToolbar = registerViewportInset('test-toolbar', () => 48)

    expect(getViewportInset()).toBe(368)

    unregisterPanel()
    expect(getViewportInset()).toBe(48)

    unregisterToolbar()
    expect(getViewportInset()).toBe(0)
  })

  it('clamps negative providers alone and alongside positive providers', () => {
    const unregisterNegative = registerViewportInset(
      'test-negative',
      () => -100
    )

    expect(getViewportInset()).toBe(0)

    const unregisterPositive = registerViewportInset('test-positive', () => 48)
    expect(getViewportInset()).toBe(48)

    unregisterNegative()
    unregisterPositive()
  })

  it('does not let an obsolete disposer remove a replacement provider', () => {
    const unregisterOld = registerViewportInset('test-replacement', () => 100)
    const unregisterCurrent = registerViewportInset(
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
    const unregisterOld = registerViewportInset('test-same-provider', provider)
    const unregisterCurrent = registerViewportInset(
      'test-same-provider',
      provider
    )

    unregisterOld()
    expect(getViewportInset()).toBe(160)

    unregisterCurrent()
    expect(getViewportInset()).toBe(0)
  })
})
