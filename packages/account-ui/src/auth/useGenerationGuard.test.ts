import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import { useGenerationGuard } from './useGenerationGuard'

describe('useGenerationGuard', () => {
  it('abandons every outstanding attempt when its owning scope is disposed', () => {
    const scope = effectScope()
    const guard = scope.run(() => useGenerationGuard())!
    const handle = guard.capture()

    expect(handle.live()).toBe(true)
    scope.stop()

    expect(
      handle.live(),
      'teardown must invalidate in-flight work so a late resolve cannot act'
    ).toBe(false)
  })

  it('invalidates a handle when its scope disposes mid-await', async () => {
    const scope = effectScope()
    const guard = scope.run(() => useGenerationGuard())!
    const handle = guard.capture()

    const settled = (async () => {
      await Promise.resolve()
      return handle.live()
    })()
    scope.stop()

    expect(
      await settled,
      'a continuation resuming after scope teardown must see a dead handle'
    ).toBe(false)
  })

  it('still abandons attempts explicitly before teardown', () => {
    const scope = effectScope()
    const guard = scope.run(() => useGenerationGuard())!
    const handle = guard.capture()

    guard.abandon()

    expect(handle.live()).toBe(false)
    scope.stop()
  })
})
