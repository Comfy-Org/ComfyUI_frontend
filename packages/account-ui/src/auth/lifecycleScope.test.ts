import { describe, expect, it, vi } from 'vitest'
import { onScopeDispose, ref, watch } from 'vue'

import { createLifecycleScope } from './lifecycleScope'

describe('createLifecycleScope', () => {
  it('runs the setup once and ignores a second start while running', () => {
    const lifecycle = createLifecycleScope()
    const setup = vi.fn()

    lifecycle.start(setup)
    lifecycle.start(setup)

    expect(
      setup,
      'a module singleton must install its listeners once, not per caller'
    ).toHaveBeenCalledOnce()
  })

  it('disposes the running scope so its watchers stop', () => {
    const lifecycle = createLifecycleScope()
    const source = ref(0)
    const seen: number[] = []
    lifecycle.start(() => {
      watch(source, (value) => seen.push(value), { flush: 'sync' })
    })

    source.value = 1
    lifecycle.stop()
    source.value = 2

    expect(
      seen,
      'a disposed scope must not keep reacting to its sources'
    ).toEqual([1])
  })

  it('restarts after an explicit stop', () => {
    const lifecycle = createLifecycleScope()
    const setup = vi.fn()

    lifecycle.start(setup)
    lifecycle.stop()
    lifecycle.start(setup)

    expect(
      setup,
      'stop reopens the latch, so a later start must run setup again'
    ).toHaveBeenCalledTimes(2)
  })

  it('reopens the latch when setup throws synchronously', () => {
    const lifecycle = createLifecycleScope()
    const good = vi.fn()

    expect(() =>
      lifecycle.start(() => {
        throw new Error('install failed')
      })
    ).toThrow('install failed')
    lifecycle.start(good)

    expect(
      good,
      'a synchronous install failure disposes its scope and reopens the latch, so the next start still installs'
    ).toHaveBeenCalledOnce()
  })

  it('fires scope-disposal hooks registered by the setup on stop', () => {
    const lifecycle = createLifecycleScope()
    const disposed = vi.fn()
    lifecycle.start(() => {
      onScopeDispose(disposed)
    })

    lifecycle.stop()

    expect(disposed).toHaveBeenCalledOnce()
  })
})
